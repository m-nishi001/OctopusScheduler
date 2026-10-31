import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { QuizSyncService } from "@octopus/game-quiz";
import { AssetRepository } from "@model/asset/asset-repository";
import { AssetSource } from "../media/asset-source";
import { prepareHostData } from "./prepare-host-data";

vi.mock("@octopus/game-jackpot", () => ({ JackpotSyncService: class JackpotSyncService {} }));
import { JackpotSyncService } from "@octopus/game-jackpot";

const emptySync = { syncAll: vi.fn(async () => ({ results: [] })) };

beforeEach(() => {
  container.clearInstances();
  container.registerInstance(QuizSyncService, emptySync as never);
  container.registerInstance(JackpotSyncService, emptySync as never);
});
afterEach(() => vi.restoreAllMocks());

describe("prepareHostData: 素材の先読み", () => {
  it("サーバーの一覧を 1 回だけ取り、先読みに渡す(進行は待たせない)", async () => {
    const prefetchAll = vi.fn(async (_items: unknown[]) => undefined);
    const listRemote = vi.fn(async () => [
      { driveDataId: "a", fileId: "root/a_x.png", parentFolderId: "root", lastUpdate: "", size: 10 },
      { driveDataId: "b", fileId: "root/b_y.mp3", parentFolderId: "root", lastUpdate: "" },
    ]);
    container.registerInstance(AssetRepository, { listRemote } as never);
    container.registerInstance(AssetSource, { prefetchAll } as never);
    await prepareHostData();
    await vi.waitFor(() => expect(prefetchAll).toHaveBeenCalledOnce());
    expect(listRemote).toHaveBeenCalledOnce();
    expect(prefetchAll.mock.calls[0][0]).toEqual([
      { id: "a", size: 10, fileId: "root/a_x.png" },
      { id: "b", size: undefined, fileId: "root/b_y.mp3" },
    ]);
  });

  it("先読みが終わらなくても、prepareHostData は返る", async () => {
    container.registerInstance(AssetRepository, { listRemote: () => new Promise(() => undefined) } as never);
    container.registerInstance(AssetSource, { prefetchAll: vi.fn() } as never);
    await expect(prepareHostData()).resolves.toEqual({ ok: true, errors: [] });
  });

  it("先読みに失敗しても握りつぶさず警告に残し、進行(結果)は止めない", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    container.registerInstance(AssetRepository, { listRemote: async () => { throw new Error("offline"); } } as never);
    container.registerInstance(AssetSource, { prefetchAll: vi.fn() } as never);
    await expect(prepareHostData()).resolves.toEqual({ ok: true, errors: [] });
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });
});
