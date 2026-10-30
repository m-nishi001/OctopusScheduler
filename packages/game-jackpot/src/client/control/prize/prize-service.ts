import { injectable, inject } from "tsyringe";
import { PrizeRepository } from "../../model/prize/prize-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { fromPrize, toPrize } from "./dto/prize-dto";
import { applyPrizeEdit, createPrize } from "../../model/prize/prize";
import type { Prize, PrizeFields } from "../../model/prize/prize";
import { CryptoIdGenerator } from "../../model/common/crypto-id-generator";

/** 景品の取得・追加・更新・削除と、当選済みの状態のリセット。 */
@injectable()
export class PrizeService {
  constructor(
    @inject(PrizeRepository) private readonly repo: PrizeRepository,
    @inject(CryptoIdGenerator) private readonly ids: CryptoIdGenerator
  ) {}

  async fetchPrizes(): Promise<PrizeDto[]> {
    const prizes = await this.repo.getPrizes();
    return prizes.map(fromPrize);
  }

  /** 新しい景品を追加する。`id` を発行し、`order` は既存の最大値 + 1 にする。 */
  async addPrize(fields: PrizeFields): Promise<Prize> {
    const prize = createPrize(fields, await this.repo.getPrizes(), this.ids.nextId());
    await this.repo.addPrizes([prize]);
    return prize;
  }

  /** `id` と `order` を持った景品を、そのまま保存する(CSV 取り込み用)。 */
  async savePrize(prize: PrizeDto): Promise<Prize> {
    const saved = toPrize(prize);
    await this.repo.addPrizes([saved]);
    return saved;
  }

  /** 既存の景品に編集した項目を反映し、同じ `id` のまま保存する。 */
  async updatePrize(id: string, fields: PrizeFields): Promise<Prize> {
    const existing = await this.repo.getPrizeById(id);
    if (!existing) throw new Error(`景品が見つかりません: ${id}`);
    const updated = applyPrizeEdit(existing, fields);
    await this.repo.addPrizes([updated]);
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
