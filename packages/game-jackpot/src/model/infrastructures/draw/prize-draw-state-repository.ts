import { LocalStorageService } from "@common-lib/storage/local-storage-service";
import { injectable } from "tsyringe";

export type PrizeDrawState = number[]; // indices when kakuhen should trigger (1-based)

@injectable()
export class PrizeDrawStateRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "PrizeDrawState"
  );

  async getState(): Promise<PrizeDrawState | null> {
    const s = (await this.localStorage.get<PrizeDrawState>("state")) || null;
    try {
      console.log("[PrizeDrawStateRepository] getState:", s);
    } catch (e) {}
    return s;
  }

  async saveState(state: PrizeDrawState): Promise<void> {
    try {
      console.log("[PrizeDrawStateRepository] saveState:", state);
    } catch (e) {}
    await this.localStorage.save("state", state);
  }

  async clearState(): Promise<void> {
    try {
      console.log("[PrizeDrawStateRepository] clearState");
    } catch (e) {}
    await this.localStorage.delete("state");
  }
}
