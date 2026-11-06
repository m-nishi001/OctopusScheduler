import { injectable, inject } from "tsyringe";
import { JackpotRepository } from "../../model/jackpot-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { fromPrize } from "./dto/prize-dto";
import { applyPrizeEdit, createPrize } from "../../model/prize/prize";
import type { Prize, PrizeFields } from "../../model/prize/prize";
import { CryptoIdGenerator } from "../../model/common/crypto-id-generator";

/** 景品の取得・追加・更新・削除と、当選済みの状態のリセット。 */
@injectable()
export class PrizeService {
  constructor(
    @inject(JackpotRepository) private readonly repo: JackpotRepository,
    @inject(CryptoIdGenerator) private readonly ids: CryptoIdGenerator
  ) {}

  async fetchPrizes(): Promise<PrizeDto[]> {
    const prizes = await this.repo.getPrizes();
    return prizes.map(fromPrize);
  }

  /** 新しい景品を追加する。`id` を発行し、`order` は既存の最大値 + 1 にする。`files` は選んだばかりの素材(名前 → 中身)。 */
  async addPrize(fields: PrizeFields, files?: ReadonlyMap<string, Blob>): Promise<Prize> {
    const prize = createPrize(fields, await this.repo.getPrizes(), this.ids.nextId());
    await this.repo.addPrizes([prize], files);
    return prize;
  }

  /** 既存の景品に編集した項目を反映し、同じ `id` のまま保存する。 */
  async updatePrize(id: string, fields: PrizeFields, files?: ReadonlyMap<string, Blob>): Promise<Prize> {
    const existing = await this.repo.getPrizeById(id);
    if (!existing) throw new Error(`景品が見つかりません: ${id}`);
    const updated = applyPrizeEdit(existing, fields);
    await this.repo.addPrizes([updated], files);
    return updated;
  }

  async deletePrize(id: string): Promise<void> {
    await this.repo.deletePrizes([id]);
  }

  async deletePrizes(ids: string[]): Promise<void> {
    await this.repo.deletePrizes(ids);
  }

  async resetAllAssigned(): Promise<void> {
    // Reset not needed since assignment is in DrawResult
  }
}
