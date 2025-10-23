import { injectable, inject } from "tsyringe";
import type { DrawRequest } from "./dto/draw-request";
import type { DrawResponse } from "./dto/draw-response";
import { DrawService } from "./draw-service";
import { DrawResultService } from "../draw-result/draw-result-service";
import { PrizeService } from "../prize/prize-service";
import { MemberService } from "../member/member-service";

@injectable()
export class DrawOrchestrator {
  constructor(
    private drawService: DrawService,
    @inject(DrawResultService) private resultService: DrawResultService,
    private prizeService: PrizeService,
    private memberService: MemberService
  ) {}

  async executeFullDraw(): Promise<DrawResponse> {
    const prizes = await this.prizeService.fetchPrizes();
    const members = await this.memberService.fetchMembers();
    const req: DrawRequest = { prizes, members };
    const response = await this.drawService.executeDraw(req);
    if (response.pairs) {
      await Promise.all(
        response.pairs.map(async (p, i) => {
          const member = members.find((m) => m.id === p.memberId);
          const prize = prizes.find((pr) => pr.id === p.prizeId);
          if (member && prize) {
            await this.resultService.addDrawResult({
              drawId: `${p.memberId}-${p.prizeId}-${Date.now()}`,
              member,
              prize,
              rank: null,
              order: i + 1,
              isWinner: true,
            });
          }
        })
      );
    }
    return response;
  }

  async executeDrawWith(args: {
    prizes: any[];
    members: any[];
  }): Promise<DrawResponse> {
    const req: DrawRequest = {
      prizes: args.prizes,
      members: args.members,
    };
    return await this.drawService.executeDraw(req);
  }

  async fetchResult() {
    return await this.resultService.getDrawResults();
  }
}
