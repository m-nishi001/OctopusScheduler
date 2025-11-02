import { LocalStorageService } from "packages/common-lib/storage/local-storage-service";
import { injectable } from "tsyringe";

export type PrizeDrawState = number[]; // indices when kakuhen should trigger (1-based)

@injectable()
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
