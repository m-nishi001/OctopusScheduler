import type { HistoryDto } from "./dto/history-dto";
import type { LotteryResultDto } from "../draw/dto/lottery-result-dto";
import { injectable, inject } from "tsyringe";
import type { IHistoryRepository } from "../../domains/history/repository/IHistoryRepository";

@injectable()
export class HistoryService {
  constructor(@inject("IHistoryRepository") private repo: IHistoryRepository) {}
  async getHistory(): Promise<HistoryDto[]> {
    const history = await this.repo.getHistory();
    return history.map((h) => ({
      id: h.id,
      drawName: h.drawName,
      result: Array.isArray(h.result)
        ? h.result.map((r: LotteryResultDto) => ({
            memberId: r.memberId,
            prizeId: r.prizeId,
            order: r.order,
            isWinner: r.isWinner,
          }))
        : [],
      savedAt: h.savedAt,
    }));
  }
}
