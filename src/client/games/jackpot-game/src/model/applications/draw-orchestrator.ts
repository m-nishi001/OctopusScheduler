import { injectable, inject } from "tsyringe";
import type { DrawRequest } from "./dto/draw-request";
import type { DrawResponse } from "./dto/draw-response";
import { DrawService } from "./draw-service";
import { ResultService } from "./result-service";
import { PrizeService } from "./prize-service";
import { MemberService } from "./member-service";

@injectable()
export class DrawOrchestrator {
  constructor(
    @inject(DrawService) private drawService: DrawService,
    @inject(ResultService) private resultService: ResultService,
    @inject(PrizeService) private prizeService: PrizeService,
    @inject(MemberService) private memberService: MemberService
  ) {}

  async executeFullDraw(): Promise<DrawResponse> {
    const prizes = await this.prizeService.fetchPrizes();
    const members = await this.memberService.fetchMembers();
    const req: DrawRequest = { prizes, members };
    return await this.drawService.executeDraw(req);
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

  async fetchResult(drawId: string) {
    return await this.resultService.getResult(drawId);
  }
}
