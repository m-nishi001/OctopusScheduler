import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrizeRepository } from "./prize-repository";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

function makeFakeApi() {
  return {
    addJson: vi.fn(async (_blob: { fileName: string; json: string }) => undefined),
    getJson: vi.fn(async (_fileName: string): Promise<{ json: string | null }> => ({ json: null })),
  };
}

describe("PrizeRepository", () => {
  let fakeApi: ReturnType<typeof makeFakeApi>;
  let repo: PrizeRepository;

  beforeEach(async () => {
    await new LocalStorageService("jackpot-game", "PrizeData").clear();
    fakeApi = makeFakeApi();
    repo = new PrizeRepository(fakeApi as any);
  });

  it("追加・上書き・削除ができ、一覧全体が1件のレコードとして保存される", async () => {
    await repo.addPrizes([{ id: "p1", name: "A", order: 1 }]);
    await repo.addPrizes([{ id: "p2", name: "B", order: 2 }, { id: "p1", name: "A2", order: 1 }]);
    expect((await repo.getPrizes()).map((p) => [p.id, p.name])).toEqual([["p1", "A2"], ["p2", "B"]]);
    expect((await repo.getPrizeById("p2"))!.name).toBe("B");
    expect(await repo.getPrizeById("none")).toBeNull();

    await repo.deletePrizes(["p1"]);
    expect((await repo.getPrizes()).map((p) => p.id)).toEqual(["p2"]);
  });

  describe("listSyncTargets", () => {
    it("どちらにも何も無ければ、ローカルもリモートも null", async () => {
      const [target] = await repo.listSyncTargets();
      expect(await target.getLocal()).toBeNull();
      expect(await target.getRemote()).toBeNull();
      expect(fakeApi.getJson).toHaveBeenCalledWith("prizes.json");
    });

    it("全件削除して空になった一覧は、データなしとは区別して同期の対象になる", async () => {
      await repo.addPrizes([{ id: "p1", name: "A", order: 1 }]);
      await repo.deletePrizes(["p1"]);
      const [target] = await repo.listSyncTargets();
      const local = await target.getLocal();
      expect(local).not.toBeNull();
      expect(local!.data).toEqual([]);
    });

    it("push は { updatedAt, data } をそのままサーバーへ保存し、ローカルへは何も書き戻さない", async () => {
      await repo.addPrizes([{ id: "p1", name: "Prize1", order: 1 }]);
      const [target] = await repo.listSyncTargets();
      const local = (await target.getLocal())!;
      await target.push(local);

      expect(fakeApi.addJson).toHaveBeenCalledOnce();
      const payload = fakeApi.addJson.mock.calls[0][0];
      expect(payload.fileName).toBe("prizes.json");
      expect(JSON.parse(payload.json)).toEqual({ updatedAt: local.updatedAt, data: [{ id: "p1", name: "Prize1", order: 1 }] });
      expect(await target.getLocal()).toEqual(local);
    });

    it("送信中に編集すると、ローカルの更新日時が送った版より新しいまま残る(次の同期でまた送られる)", async () => {
      await repo.addPrizes([{ id: "p1", name: "A", order: 1 }]);
      const [target] = await repo.listSyncTargets();
      const sent = (await target.getLocal())!;
      fakeApi.addJson.mockImplementationOnce(async () => {
        await repo.addPrizes([{ id: "p2", name: "B", order: 2 }]); // 送信の最中の編集
      });
      await target.push(sent);

      const local = (await target.getLocal())!;
      expect(local.updatedAt).toBeGreaterThan(sent.updatedAt);
      expect(local.data.map((p) => p.id)).toEqual(["p1", "p2"]);
    });

    it("pull はリモートのレコードをそのまま書き(更新日時も同じ)、ローカルを置き換える", async () => {
      const [target] = await repo.listSyncTargets();
      await target.pull({ data: [{ id: "p1", name: "Remote Prize", order: 1 }], updatedAt: 1234 }, null);

      expect(await repo.getPrizes()).toEqual([{ id: "p1", name: "Remote Prize", order: 1 }]);
      expect((await target.getLocal())!.updatedAt).toBe(1234);
    });

    it("pull の途中(判定のあと)に編集されていたら、書かずに false を返し、編集が残る", async () => {
      await repo.addPrizes([{ id: "p1", name: "A", order: 1 }]);
      const [target] = await repo.listSyncTargets();
      const decided = await target.getLocal();
      await repo.addPrizes([{ id: "p2", name: "追加中", order: 2 }]);

      const applied = await target.pull({ data: [{ id: "r", name: "Remote", order: 1 }], updatedAt: decided!.updatedAt + 100_000 }, decided);

      expect(applied).toBe(false);
      expect((await repo.getPrizes()).map((p) => p.id)).toEqual(["p1", "p2"]);
    });

    it("getRemote はサーバーのテキストを { data, updatedAt } として読む。古い形式(配列だけ)は無いものとして扱う", async () => {
      fakeApi.getJson.mockResolvedValueOnce({ json: JSON.stringify({ updatedAt: 99, data: [{ id: "p1", name: "Remote", order: 1 }] }) });
      const [target] = await repo.listSyncTargets();
      expect(await target.getRemote()).toEqual({ updatedAt: 99, data: [{ id: "p1", name: "Remote", order: 1 }] });

      fakeApi.getJson.mockResolvedValueOnce({ json: JSON.stringify([{ id: "old" }]) });
      expect(await target.getRemote()).toBeNull();
    });

    it("リモートの読み取りに失敗したら例外のまま伝える(空と取り違えてローカルを上書きしない)", async () => {
      fakeApi.getJson.mockRejectedValueOnce(new Error("HTTP 500: boom"));
      const [target] = await repo.listSyncTargets();
      await expect(target.getRemote()).rejects.toThrow("HTTP 500: boom");
    });
  });
});
