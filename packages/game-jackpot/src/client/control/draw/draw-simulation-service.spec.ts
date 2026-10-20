import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { DrawSimulationService } from "./draw-simulation-service";
import { MathRandomProvider } from "../../model/common/math-random-provider";

/**
 * シミュレーションは本番のデータに触れない、という保証のテスト。
 * 以前は本番のメンバー・景品・抽選結果を書き換えて、あとで戻す方式だった。途中でタブを閉じたり失敗したりすると、
 * ダミーのデータが本番に残り、同期で他の端末にも広がりえた。
 */

// ブラウザの保存領域（localforage）に触れたら、その時点で失敗させる。
vi.mock("@octopus/client-common/storage/local-storage-service", () => ({
  LocalStorageService: class {
    constructor() {
      throw new Error("シミュレーションがブラウザの保存領域に触れた");
    }
  },
}));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("DrawSimulationService", () => {
  it("景品が尽きるまで引き、全員が別々の景品に当たる（メンバー ≧ 景品）", async () => {
    const { results } = await new DrawSimulationService().runSimulation(10, 6);
    expect(results).toHaveLength(6);
    expect(new Set(results.map((r) => r.wonPrize?.id)).size).toBe(6);
    expect(new Set(results.map((r) => r.wonMember?.id)).size).toBe(6);
  });

  it("メンバーが景品より少ないときは、メンバーが尽きたところで止まる（例外にしない）", async () => {
    const { results } = await new DrawSimulationService().runSimulation(3, 10);
    expect(results).toHaveLength(3);
  });

  it("本番の保存領域・DI コンテナには一切触れない（保存領域に触れると失敗するモックで確認）", async () => {
    const before = container.isRegistered(MathRandomProvider);
    await expect(new DrawSimulationService().runSimulation(20, 8, [0.1, 0.9, 0.5])).resolves.toBeDefined();
    expect(container.isRegistered(MathRandomProvider)).toBe(before);
  });

  it("乱数の並びを指定すると、同じ結果を再現できる", async () => {
    const service = new DrawSimulationService();
    const a = await service.runSimulation(15, 8, [0.2, 0.7, 0.4, 0.9]);
    const b = await service.runSimulation(15, 8, [0.2, 0.7, 0.4, 0.9]);
    const names = (r: typeof a) => r.results.map((x) => `${x.wonMember?.name}:${x.wonPrize?.name}`);
    expect(names(a)).toEqual(names(b));
  });

  it("続けて実行しても、前回の結果が混ざらない", async () => {
    const service = new DrawSimulationService();
    await service.runSimulation(10, 5);
    const second = await service.runSimulation(10, 5);
    expect(second.results).toHaveLength(5);
  });

  it("CSV に見出しと結果の行が出る", async () => {
    const { results, csv } = await new DrawSimulationService().runSimulation(5, 3);
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"Draw ID","Member Name","Prize Name","Prize Weight","Is Kakuhen"');
    expect(lines).toHaveLength(1 + results.length);
  });
});
