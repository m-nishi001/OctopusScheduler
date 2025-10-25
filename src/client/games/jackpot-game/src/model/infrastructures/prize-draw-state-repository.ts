import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";

export interface PrizeDrawState {
  total: number;
  remaining: number;
  drawCount: number;
  kakuhenTimings: number[]; // indices when kakuhen should trigger (1-based)
  reservedPrizeIds: string[];
  initializedAt: string;
}

export class PrizeDrawStateRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "PrizeDrawState"
  );

  async getState(): Promise<PrizeDrawState | null> {
    return (await this.localStorage.get<PrizeDrawState>("state")) || null;
  }

  async saveState(state: PrizeDrawState): Promise<void> {
    await this.localStorage.save("state", state);
  }

  async clearState(): Promise<void> {
    await this.localStorage.delete("state");
  }
}
