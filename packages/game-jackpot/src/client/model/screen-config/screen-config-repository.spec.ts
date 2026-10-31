import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScreenConfigRepository } from "./screen-config-repository";
import { ScreenSetting } from "./screen-setting";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

function makeFakeApi() {
  return {
    addJson: vi.fn(async (_blob: { fileName: string; json: string }) => undefined),
    getJson: vi.fn(async (_fileName: string): Promise<{ json: string | null }> => ({ json: null })),
  };
}

describe("ScreenConfigRepository", () => {
  let fakeApi: ReturnType<typeof makeFakeApi>;
  let repo: ScreenConfigRepository;

  beforeEach(async () => {
    await new LocalStorageService("jackpot-game", "ScreenConfigData").clear();
    fakeApi = makeFakeApi();
    repo = new ScreenConfigRepository(fakeApi as any);
  });

  it("同じ画面名・項目名は上書きし、別の項目は残す", async () => {
    await repo.updateScreenSettings([new ScreenSetting("home", "a", "1"), new ScreenSetting("home", "b", "2")]);
    await repo.updateScreenSettings([new ScreenSetting("home", "a", "9")]);
    expect((await repo.getScreenSettings()).map((s) => [s.settingName, s.settingValue])).toEqual([["a", "9"], ["b", "2"]]);
    expect(await repo.getScreenSettingsByType("home")).toHaveLength(2);
  });

  describe("listSyncTargets", () => {
    it("設定を一度も保存していなければ、ローカルは null", async () => {
      const [target] = await repo.listSyncTargets();
      expect(await target.getLocal()).toBeNull();
    });

    it("初めて開く端末でも、サーバーの screens.json(試験環境のシード等)をそのまま取り込める", async () => {
      const seeded = [{ screenName: "opening", settingName: "opening-screen-settings", settingValue: "{}" }];
      fakeApi.getJson.mockResolvedValueOnce({ json: JSON.stringify({ updatedAt: 1000, data: seeded }) });
      const [target] = await repo.listSyncTargets();
      const remote = (await target.getRemote())!;
      expect(fakeApi.getJson).toHaveBeenCalledWith("screens.json");
      expect(remote).toEqual({ updatedAt: 1000, data: seeded });

      await target.pull(remote, await target.getLocal());
      expect(await repo.getScreenSettings()).toEqual(seeded);
    });

    it("push は { updatedAt, data } をそのまま保存し、ローカルへ書き戻さない", async () => {
      await repo.updateScreenSettings([new ScreenSetting("home", "background", JSON.stringify({ color: "red" }))]);
      const [target] = await repo.listSyncTargets();
      const local = (await target.getLocal())!;
      await target.push(local);

      expect(fakeApi.addJson).toHaveBeenCalledOnce();
      const payload = fakeApi.addJson.mock.calls[0][0];
      expect(payload.fileName).toBe("screens.json");
      expect(JSON.parse(payload.json)).toEqual({ updatedAt: local.updatedAt, data: local.data });
      expect(await target.getLocal()).toEqual(local);
    });

    it("送信中に別の値を保存しても、その値が残り、ローカルの更新日時のほうが新しいまま(次の同期でまた送られる)", async () => {
      await repo.updateScreenSettings([new ScreenSetting("main", "main-screen-settings", JSON.stringify({ prizeStopSec: 15 }))]);
      const [target] = await repo.listSyncTargets();
      const sent = (await target.getLocal())!;
      fakeApi.addJson.mockImplementationOnce(async () => {
        await repo.updateScreenSettings([new ScreenSetting("main", "main-screen-settings", JSON.stringify({ prizeStopSec: 4 }))]);
      });
      await target.push(sent);

      const local = (await target.getLocal())!;
      expect(local.updatedAt).toBeGreaterThan(sent.updatedAt);
      expect(JSON.parse(local.data[0].settingValue)).toEqual({ prizeStopSec: 4 });
    });

    it("pull の途中に保存された値は、書き換えられずに残る", async () => {
      await repo.updateScreenSettings([new ScreenSetting("home", "a", "1")]);
      const [target] = await repo.listSyncTargets();
      const decided = await target.getLocal();
      await repo.updateScreenSettings([new ScreenSetting("home", "a", "編集中")]);

      const applied = await target.pull({ data: [new ScreenSetting("home", "a", "remote")], updatedAt: decided!.updatedAt + 100_000 }, decided);

      expect(applied).toBe(false);
      expect((await repo.getScreenSettings())[0].settingValue).toBe("編集中");
    });
  });
});
