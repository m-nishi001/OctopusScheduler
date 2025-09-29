import { injectable, inject } from "tsyringe";
import { Member } from "../../domain/entities/member";
import { Prize } from "../../domain/entities/prize";
import { MemberDto } from "../dtos/member.dto";
import { PrizeDto } from "../dtos/prize.dto";
import { toMember, toMemberDto } from "../dtos/member.mapper";
import { toPrize, toPrizeDto } from "../dtos/prize.mapper";
import { DrawResultDto } from "../dtos/draw-result.dto";
import { GasService } from "./gas-service";
import { DrawStrategy } from "../../domain/draw-strategies/draw-strategy";
import { DrawPairingService } from "./draw-pairing-service";
import { DrawResultService } from "./draw-result-service";

@injectable()
export class LotteryCoordinator implements GasService {
  public serviceName = "LotteryService";
  public functions: Record<string, (args: any) => any>;

  constructor(
    @inject("MemberDrawStrategy")
    private memberDrawStrategy: DrawStrategy<Member>,
    @inject("PrizeDrawStrategy") private prizeDrawStrategy: DrawStrategy<Prize>,
    @inject("DrawPairingService")
    private drawPairingService: DrawPairingService,
    @inject("DrawResultService") private drawResultService: DrawResultService
  ) {
    this.functions = {
      drawMember: this.drawMember.bind(this),
      drawPrize: this.drawPrize.bind(this),
      drawAll: this.drawAll.bind(this),
      draw: this.draw.bind(this),
    };
  }

  drawMember(args: { members: MemberDto[]; weights?: number[] }): MemberDto {
    const domainMembers = args.members.map(toMember);
    const drawn = this.memberDrawStrategy.draw(domainMembers, {
      weights: args.weights,
    });
    return toMemberDto(drawn);
  }

  drawPrize(args: { prizes: PrizeDto[]; weights?: number[] }): PrizeDto {
    const domainPrizes = args.prizes.map(toPrize);
    const drawn = this.prizeDrawStrategy.draw(domainPrizes, {
      weights: args.weights,
    });
    return toPrizeDto(drawn);
  }

  drawAll(args: {
    prizes: PrizeDto[];
    members: MemberDto[];
    memberWeights?: number[];
    prizeWeights?: number[];
  }): DrawResultDto[] {
    const members = args.members.map(toMember);
    const prizes = args.prizes.map(toPrize);
    return this.drawPairingService.pairAndSave(
      members,
      prizes,
      args.memberWeights,
      args.prizeWeights
    );
  }

  draw(args: {
    prizes: PrizeDto[];
    members: MemberDto[];
    memberWeights?: number[];
    prizeWeights?: number[];
  }): { drawId: string; status: "completed" } {
    const drawId = `draw_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const results = this.drawAll(args);
    for (const result of results) {
      result.drawId = drawId;
      this.drawResultService.save({ result });
    }
    return { drawId, status: "completed" };
  }
}
