import { injectable, container } from "tsyringe";
import { DrawApplicationService } from "./draw-application-service";
import { MemberRepository } from "../../infrastructures/member-repository";
import { PrizeRepository } from "../../infrastructures/prize-repository";
import { DrawResultService } from "./draw-result-service";
import { PrizeDrawStateRepository } from "../../infrastructures/prize-draw-state-repository";
import type { MemberDto } from "../member/dto/member-dto";
import type { PrizeDto } from "../prize/dto/prize-dto";
import type { DrawResultDto } from "./dto/draw-result-dto";

@injectable()
export class DrawTestService {
  private drawAppService: DrawApplicationService;
  private memberRepo: MemberRepository;
  private prizeRepo: PrizeRepository;
  private drawResultService: DrawResultService;
  private prizeDrawStateRepository: PrizeDrawStateRepository;

  // Backups for restore after test
  private backupMembers: MemberDto[] | null = null;
  private backupPrizes: PrizeDto[] | null = null;
  private backupResults: DrawResultDto[] | null = null;
  private backupState: number[] | null = null;
  private readonly PERSIST_KEY = "jackpot-test-backup";

  constructor() {
    this.drawAppService = container.resolve(DrawApplicationService);
    this.memberRepo = container.resolve(MemberRepository);
    this.prizeRepo = container.resolve(PrizeRepository);
    this.drawResultService = container.resolve(DrawResultService);
    this.prizeDrawStateRepository = container.resolve(PrizeDrawStateRepository);
  }

  // Main simulation method
  async runSimulation(
    memberCount: number,
    prizeCount: number
  ): Promise<{ results: DrawResultDto[]; csv: string }> {
    try {
      // 1. バックアップを取得
      await this.backupCurrentData();

      // 2. テストデータ投入
      await this.setDummyData(memberCount, prizeCount);

      // 3. シミュレーション実行
      const results = await this.runDrawSimulation();

      // 4. シミュレート結果を取得 (already collected in results)

      // 5. バックアップを復元
      await this.restoreBackup();

      // 6. シミュレート結果を表示 (return results and CSV)
      const csv = this.generateCsv(results);
      return { results, csv };
    } catch (error) {
      console.error("Simulation failed:", error);
      // Attempt to restore backup even on failure
      try {
        await this.restoreBackup();
      } catch (restoreError) {
        console.error("Failed to restore backup:", restoreError);
      }
      throw error;
    }
  }

  private async backupCurrentData(): Promise<void> {
    console.info("Backing up current data...");
    this.backupMembers = (await this.memberRepo.getMembers()).map((m) => ({
      ...m,
    }));
    this.backupPrizes = (await this.prizeRepo.getPrizes()).map((p) => ({
      ...p,
    }));
    this.backupResults = (await this.drawResultService.getDrawResults()).map(
      (r) => ({ ...r })
    );
    this.backupState = await this.prizeDrawStateRepository.getState();

    // Persist to localStorage
    try {
      const payload = JSON.stringify({
        backupMembers: this.backupMembers,
        backupPrizes: this.backupPrizes,
        backupResults: this.backupResults,
        backupState: this.backupState,
      });
      window.localStorage.setItem(this.PERSIST_KEY, payload);
    } catch (e) {
      console.warn("Failed to persist backup:", e);
    }
    console.info("Backup complete");
  }

  private async setDummyData(
    memberCount: number,
    prizeCount: number
  ): Promise<void> {
    console.info("Setting dummy data...");

    const dummyMembers: MemberDto[] = [];
    for (let i = 1; i <= memberCount; i++) {
      dummyMembers.push({
        id: `member-${i}`,
        name: `メンバー${i}`,
        rank: ((i - 1) % 3) + 1, // 1,2,3 を繰り返す
        photoAssetId: "dummy",
      });
    }

    const dummyPrizes: PrizeDto[] = [];
    for (let i = 1; i <= prizeCount; i++) {
      dummyPrizes.push({
        id: `prize-${i}`,
        name: `景品${i}`,
        rank: ((i - 1) % 3) + 1, // 1,2,3 を繰り返す
        imageAssetId: "dummy",
        animation: "roulette",
        order: i,
      });
    }

    await this.memberRepo.replaceAllMembers(dummyMembers as any);
    await this.prizeRepo.replaceAllPrizes(dummyPrizes as any);

    // Clear existing results
    const existingResults = await this.drawResultService.getDrawResults();
    for (const r of existingResults) {
      await this.drawResultService.deleteDrawResult(r.drawId);
    }

    // Clear state to ensure initialization
    await this.prizeDrawStateRepository.clearState();

    // Initialize state
    const savedPrizes = await this.prizeRepo.getPrizes();
    await this.drawAppService.initializeStateIfNeeded(savedPrizes as any);

    console.info("Dummy data set");
  }

  private async runDrawSimulation(): Promise<DrawResultDto[]> {
    console.info("Running draw simulation...");
    const results: DrawResultDto[] = [];
    let continueDraw = true;
    while (continueDraw) {
      try {
        const res = await this.drawAppService.executeDraw({
          memberRequestCount: 10,
          prizeRequestCount: 8,
        });
        results.push(res);

        const count = await this.drawAppService.getLastPrizeCount();
        if (results.length >= count.total - 1) {
          continueDraw = false;
        }
      } catch (e) {
        console.error("Error in draw execution:", e);
        break;
      }
    }

    console.info(`Simulation complete: ${results.length} draws`);
    return results;
  }

  // バックアップを復元
  async restoreBackup(): Promise<void> {
    console.info("Restoring backup...");
    if (this.backupMembers) {
      await this.memberRepo.replaceAllMembers(this.backupMembers as any);
    }
    if (this.backupPrizes) {
      await this.prizeRepo.replaceAllPrizes(this.backupPrizes as any);
    }

    // Clear current results and restore
    const currentResults = await this.drawResultService.getDrawResults();
    for (const r of currentResults) {
      await this.drawResultService.deleteDrawResult(r.drawId);
    }
    if (this.backupResults) {
      for (const r of this.backupResults) {
        await this.drawResultService.addDrawResult(r);
      }
    }

    // Restore state
    if (this.backupState) {
      await this.prizeDrawStateRepository.saveState(this.backupState);
    } else {
      await this.prizeDrawStateRepository.clearState();
    }

    // Clear backups
    this.backupMembers = null;
    this.backupPrizes = null;
    this.backupResults = null;
    this.backupState = null;

    console.info("Backup restored");
  }

  // 結果をCSV形式で取得
  generateCsv(results: DrawResultDto[]): string {
    const headers = [
      "Draw ID",
      "Member Name",
      "Prize Name",
      "Prize Rank",
      "Is Kakuhen",
    ];
    const rows = results.map((result) => [
      result.drawId,
      result.wonMember?.name || "",
      result.wonPrize?.name || "",
      result.wonPrize?.rank || "",
      (result.isKakuhen || false).toString(),
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
  }
}
