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

  constructor() {
    this.drawAppService = container.resolve(DrawApplicationService);
    this.memberRepo = container.resolve(MemberRepository);
    this.prizeRepo = container.resolve(PrizeRepository);
    this.drawResultService = container.resolve(DrawResultService);
    this.prizeDrawStateRepository = container.resolve(PrizeDrawStateRepository);
  }

  // ダミーデータ生成
  async generateDummyData(): Promise<void> {
    // ダミーメンバー生成
    const dummyMembers: MemberDto[] = [
      { id: "member-1", name: "メンバー1", rank: 1, photoAssetId: "dummy" },
      { id: "member-2", name: "メンバー2", rank: 2, photoAssetId: "dummy" },
      { id: "member-3", name: "メンバー3", rank: 3, photoAssetId: "dummy" },
      { id: "member-4", name: "メンバー4", rank: 1, photoAssetId: "dummy" },
      { id: "member-5", name: "メンバー5", rank: 2, photoAssetId: "dummy" },
      { id: "member-6", name: "メンバー6", rank: 3, photoAssetId: "dummy" },
      { id: "member-7", name: "メンバー7", rank: 1, photoAssetId: "dummy" },
      { id: "member-8", name: "メンバー8", rank: 2, photoAssetId: "dummy" },
      { id: "member-9", name: "メンバー9", rank: 3, photoAssetId: "dummy" },
      { id: "member-10", name: "メンバー10", rank: 1, photoAssetId: "dummy" },
    ];

    // ダミー景品生成
    const dummyPrizes: PrizeDto[] = [
      {
        id: "prize-1",
        name: "景品1",
        rank: 1,
        probability: 0.1,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 1,
        isAssigned: false,
        isReserved: false,
      },
      {
        id: "prize-2",
        name: "景品2",
        rank: 2,
        probability: 0.2,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 2,
        isAssigned: false,
        isReserved: false,
      },
      {
        id: "prize-3",
        name: "景品3",
        rank: 3,
        probability: 0.3,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 3,
        isAssigned: false,
        isReserved: false,
      },
      {
        id: "prize-4",
        name: "景品4",
        rank: 1,
        probability: 0.1,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 4,
        isAssigned: false,
        isReserved: false,
      },
      {
        id: "prize-5",
        name: "景品5",
        rank: 2,
        probability: 0.2,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 5,
        isAssigned: false,
        isReserved: false,
      },
      {
        id: "prize-6",
        name: "景品6",
        rank: 3,
        probability: 0.3,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 6,
        isAssigned: false,
        isReserved: false,
      },
      {
        id: "prize-7",
        name: "景品7",
        rank: 1,
        probability: 0.1,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 7,
        isAssigned: false,
        isReserved: false,
      },
      {
        id: "prize-8",
        name: "景品8",
        rank: 2,
        probability: 0.2,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 8,
        isAssigned: false,
        isReserved: false,
      },
      {
        id: "prize-9",
        name: "景品9",
        rank: 3,
        probability: 0.3,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 9,
        isAssigned: false,
        isReserved: false,
      },
      {
        id: "prize-10",
        name: "景品10",
        rank: 1,
        probability: 0.1,
        imageAssetId: "dummy",
        animation: "roulette",
        order: 10,
        isAssigned: false,
        isReserved: false,
      },
    ];

    // 既存データをクリア（テスト用）
    await this.clearDummyData();

    // データを保存
    await this.memberRepo.addMembers(dummyMembers);
    await this.prizeRepo.addPrizes(dummyPrizes);
  }

  // 全抽選実行
  async runFullDrawProcess(): Promise<DrawResultDto[]> {
    const results: DrawResultDto[] = [];
    let continueDraw = true;

    while (continueDraw) {
      // メンバー抽選
      const memberResult = await this.drawAppService.executeMemberDraw({
        requestCount: 10,
      });
      if (memberResult.winnerId) {
        // メンバー当選結果を追加済み
        const memberDrawResult = await this.drawResultService.getDrawResultById(
          memberResult.drawId
        );
        if (memberDrawResult) {
          results.push(memberDrawResult);
        }

        // 景品抽選
        const prizeResult = await this.drawAppService.executePrizeDraw({
          memberId: memberResult.winnerId,
          requestCount: 8,
        });
        if (prizeResult.winnerPrizeId) {
          const prizeDrawResult =
            await this.drawResultService.getDrawResultById(prizeResult.drawId);
          if (prizeDrawResult) {
            results.push(prizeDrawResult);
          }
        }

        // 景品残数チェック
        const count = await this.drawAppService.getLastPrizeCount();
        if (count.remaining === 0) {
          continueDraw = false;
        }
      } else {
        // 当選者なしで終了
        continueDraw = false;
      }
    }

    return results;
  }

  // 確変テスト実行
  async runKakuhenTest(): Promise<DrawResultDto[]> {
    const results: DrawResultDto[] = [];
    let kakuhenOccurred = false;

    while (!kakuhenOccurred) {
      // メンバー抽選
      const memberResult = await this.drawAppService.executeMemberDraw({
        requestCount: 10,
      });
      if (memberResult.winnerId) {
        // メンバー当選結果を追加済み
        const memberDrawResult = await this.drawResultService.getDrawResultById(
          memberResult.drawId
        );
        if (memberDrawResult) {
          results.push(memberDrawResult);
        }

        // 景品抽選
        const prizeResult = await this.drawAppService.executePrizeDraw({
          memberId: memberResult.winnerId,
          requestCount: 8,
        });
        if (prizeResult.winnerPrizeId) {
          const prizeDrawResult =
            await this.drawResultService.getDrawResultById(prizeResult.drawId);
          if (prizeDrawResult) {
            results.push(prizeDrawResult);
            if (prizeResult.isKakuhen) {
              kakuhenOccurred = true;
            }
          }
        }

        // 景品残数チェック
        const count = await this.drawAppService.getLastPrizeCount();
        if (count.remaining === 0) {
          break;
        }
      } else {
        // 当選者なしで終了
        break;
      }
    }

    return results;
  }

  // 結果をCSV形式で取得
  generateCsv(results: DrawResultDto[]): string {
    const headers = [
      "Draw ID",
      "Member Name",
      "Member Rank",
      "Prize Name",
      "Prize Rank",
      "Order",
      "Is Winner",
      "Is Kakuhen",
    ];
    const rows = results.map((result) => [
      result.drawId,
      result.member?.name || "",
      result.memberRank?.toString() || "",
      result.prize?.name || "",
      result.prizeRank?.toString() || "",
      result.order.toString(),
      result.isWinner.toString(),
      (result.isKakuhen || false).toString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    return csvContent;
  }

  // ダミーデータクリア
  async clearDummyData(): Promise<void> {
    // メンバークリア
    const members = await this.memberRepo.getMembers();
    const memberIdsToDelete = members
      .filter((m) => m.id.startsWith("member-"))
      .map((m) => m.id);
    if (memberIdsToDelete.length > 0) {
      await this.memberRepo.deleteMembers(memberIdsToDelete);
    }

    // 景品クリア
    const prizes = await this.prizeRepo.getPrizes();
    const prizeIdsToDelete = prizes
      .filter((p) => p.id.startsWith("prize-"))
      .map((p) => p.id);
    if (prizeIdsToDelete.length > 0) {
      await this.prizeRepo.deletePrizes(prizeIdsToDelete);
    }

    // 結果クリア
    const results = await this.drawResultService.getDrawResults();
    for (const result of results) {
      await this.drawResultService.deleteDrawResult(result.drawId);
    }

    // 抽選状態クリア
    await this.prizeDrawStateRepository.clearState();
  }
}
