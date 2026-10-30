import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { PrizeService } from "./prize-service";
import { PrizeRepository } from "../../model/prize/prize-repository";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

describe("PrizeService", () => {
  let service: PrizeService;
  let n: number;

  beforeEach(async () => {
    await new LocalStorageService("jackpot-game", "PrizeData").clear();
    await new LocalStorageService("jackpot-game", "SyncDirtyTracker").clear();
    n = 0;
    service = new PrizeService(new PrizeRepository({} as never), { nextId: () => `id-${++n}` } as never);
  });

  it("追加を2回すると2件になり、id は別々で order は増えていく", async () => {
    await service.addPrize({ name: "A" });
    await service.addPrize({ name: "B" });
    const prizes = (await service.fetchPrizes()).sort((x, y) => x.order - y.order);
    expect(prizes.map((p) => [p.id, p.name, p.order])).toEqual([
      ["id-1", "A", 1],
      ["id-2", "B", 2],
    ]);
  });

  it("2件を続けて編集しても、両方残り、id と order が保たれる", async () => {
    await service.addPrize({ name: "A" });
    await service.addPrize({ name: "B" });

    await service.updatePrize("id-1", { name: "A2", weight: 5 });
    await service.updatePrize("id-2", { name: "B2", weight: 9 });

    const prizes = (await service.fetchPrizes()).sort((x, y) => x.order - y.order);
    expect(prizes.map((p) => [p.id, p.name, p.order, p.weight])).toEqual([
      ["id-1", "A2", 1, 5],
      ["id-2", "B2", 2, 9],
    ]);
  });

  it("存在しない景品の編集は失敗し、何も増えない", async () => {
    await service.addPrize({ name: "A" });
    await expect(service.updatePrize("none", { name: "x" })).rejects.toThrow();
    expect(await service.fetchPrizes()).toHaveLength(1);
  });
});
