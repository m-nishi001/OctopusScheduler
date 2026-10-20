import { injectable } from "tsyringe";
import { createInMemoryDrawApp } from "./in-memory-draw-app";
import type { DrawApplicationService } from "./draw-application-service";
import type { DrawResultDto } from "./dto/draw-result-dto";
import { FixedRandomProvider } from "../../model/common/fixed-random-provider";
import type { Member } from "../../model/member/member";
import type { Prize } from "../../model/prize/prize";

/**
 * 抽選のシミュレーション（設定画面の「テスト」）。ダミーのメンバーと景品を全部引き切り、結果を返す。
 *
 * 抽選はメモリ上だけで行う（{@link createInMemoryDrawApp}）。本番のメンバー・景品・抽選結果・確変の状態には
 * 一切触れないので、途中でタブを閉じても、失敗しても、本番のデータが書き換わったままになることはない。
 */
@injectable()
export class DrawSimulationService {
  /**
   * ダミーのメンバー `memberCount` 人・景品 `prizeCount` 個で、景品が尽きるまで抽選する。
   *
   * @param randomValues 指定すると、乱数をこの並び（0以上1未満）の繰り返しにして、結果を再現できる。
   * @returns 抽選結果（引いた順）と、そのCSV
   */
  async runSimulation(
    memberCount: number,
    prizeCount: number,
    randomValues?: number[]
  ): Promise<{ results: DrawResultDto[]; csv: string }> {
    const prizes = this.dummyPrizes(prizeCount);
    const { app } = createInMemoryDrawApp({
      members: this.dummyMembers(memberCount),
      prizes,
      random: randomValues && randomValues.length > 0 ? new FixedRandomProvider(randomValues) : undefined,
    });
    await app.initializeStateIfNeeded(prizes);
    const results = await this.drawUntilPrizesRunOut(app, prizes.length);
    return { results, csv: this.generateCsv(results) };
  }

  private dummyMembers(count: number): Member[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `member-${i + 1}`,
      name: `メンバー${i + 1}`,
      rank: (i % 3) + 1,
      photoAssetId: "dummy",
    }));
  }

  /** レア度の異なる景品が混ざるよう、重みを 1 / 10 / 80 の順に繰り返す。 */
  private dummyPrizes(count: number): Prize[] {
    const weights = [1, 10, 80];
    return Array.from({ length: count }, (_, i) => ({
      id: `prize-${i + 1}`,
      name: `景品${i + 1}`,
      weight: weights[i % weights.length],
      imageAssetId: "dummy",
      animation: "roulette",
      order: i + 1,
    }));
  }

  /** 景品が尽きるまで引く。メンバーが尽きたとき・想定外の失敗のときは、そこまでの結果を返す。 */
  private async drawUntilPrizesRunOut(app: DrawApplicationService, prizeCount: number): Promise<DrawResultDto[]> {
    const results: DrawResultDto[] = [];
    const limit = Math.max(50, prizeCount * 3); // 無限ループの安全弁
    for (let i = 0; i < limit; i++) {
      try {
        const { result } = await app.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
        if (result) results.push(result);
        if ((await app.getRemainingPrizes()).length === 0) break;
      } catch (error) {
        console.error("Error in draw execution:", error);
        break;
      }
    }
    return results;
  }

  /** 結果をCSV形式にする。 */
  generateCsv(results: DrawResultDto[]): string {
    const headers = ["Draw ID", "Member Name", "Prize Name", "Prize Weight", "Is Kakuhen"];
    const rows = results.map((result) => [
      result.drawId,
      result.wonMember?.name || "",
      result.wonPrize?.name || "",
      result.wonPrize?.weight || "",
      (result.isKakuhen || false).toString(),
    ]);
    return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  }
}
