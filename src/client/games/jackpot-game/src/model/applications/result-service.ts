import type { ResultResponse } from "./dto/result-response";
import { injectable, inject } from "tsyringe";
import type { IResultRepository } from "../../model/domains/result/repository/IResultRepository";
import type { IAssetRepository } from "../domains/asset/repository/IAssetRepository";

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
          return { ...r, member: { ...r.member, photoUrl: asset?.url } };
        }
        return r;
      })
    );
    return { results: resolvedResults };
  }
}
