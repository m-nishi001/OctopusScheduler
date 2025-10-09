import type { ResultResponse } from "./dto/result-response";
import { injectable, inject } from "tsyringe";
import type { IResultRepository } from "../../domains/result/repository/IResultRepository";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";

@injectable()
export class ResultService {
  constructor(
    @inject("IResultRepository") private repo: IResultRepository,
    @inject("IAssetRepository") private assetRepo: IAssetRepository
  ) {}
  async getResult(drawId: string): Promise<ResultResponse | null> {
    const result = await this.repo.getResult(drawId);
    if (!result) return null;
    // アセットIDをURLに解決
    const resolvedResults = await Promise.all(
      result.results.map(async (r) => {
        if (r.member.photoAssetId) {
          const asset = await this.assetRepo.getAssetById(
            r.member.photoAssetId
          );
          return {
            ...r,
            member: { ...r.member, photoDataUrl: asset?.dataUrl },
          };
        }
        return r;
      })
    );
    return { results: resolvedResults };
  }

  /**
   * View 向けの整形済みデータを返却するヘルパー。
   * - results を view 用オブジェクトに変換
   * - 最高/最低ランク当選者を算出して返す
   */
  async getResultForView(drawId: string) {
    const resp = await this.getResult(drawId);
    if (!resp || !resp.results) {
      return { winners: [], specialWinner: undefined, lowestWinner: undefined };
    }
    const winners = resp.results.map((r, idx) => {
      const prizeAny = (r.prize as any) || {};
      const rank = typeof prizeAny.rank === "number" ? prizeAny.rank : null;
      return {
        id: idx + 1,
        name: r.member?.name || r.member?.id,
        photo: r.member?.photoAssetId || "",
        prize: r.prize?.name || r.prize?.id || "",
        rank,
        raw: r,
      };
    });

    const ranks = winners
      .map((w) => (typeof w.rank === "number" ? w.rank : null))
      .filter((v) => v !== null) as number[];
    let specialWinner = undefined;
    let lowestWinner = undefined;
    if (ranks.length > 0) {
      const minRank = Math.min(...ranks);
      const maxRank = Math.max(...ranks);
      specialWinner = winners.find((w) => w.rank === minRank);
      lowestWinner = winners.find((w) => w.rank === maxRank);
    }
    return { winners, specialWinner, lowestWinner };
  }
}
