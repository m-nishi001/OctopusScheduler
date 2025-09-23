import { DrawResult } from "../../domain/entities/draw-result";
import { Member } from "../../domain/entities/member";
import { Prize } from "../../domain/entities/prize";
import { ScreenContent } from "../../domain/entities/screen-content";
import { IDrawResultRepository } from "../../domain/repositories/draw-result-repository";
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { IPrizeRepository } from "../../domain/repositories/prize-repository";
import { IScreenContentRepository } from "../../domain/repositories/screen-content-repository";

export class JackpodGasService {
  public serviceName = "JackpodService";
  public functions: { [key: string]: Function };

  constructor(
    private memberRepo: IMemberRepository,
    private prizeRepo: IPrizeRepository,
    private drawResultRepo: IDrawResultRepository,
    private screenContentRepo: IScreenContentRepository
  ) {
    this.functions = {
      getMembers: this.getMembers.bind(this),
      getPrizes: this.getPrizes.bind(this),
      draw: this.draw.bind(this),
      getResults: this.getResults.bind(this),
      getScreenContents: this.getScreenContents.bind(this)
    };
  }

  async getMembers(): Promise<Member[]> {
    return await this.memberRepo.findAll();
  }

  async getPrizes(): Promise<Prize[]> {
    return await this.prizeRepo.findAll();
  }

  async draw(params: { memberId: string; prizeId: string }): Promise<DrawResult> {
    const member = await this.memberRepo.findById(params.memberId);
    const prize = await this.prizeRepo.findById(params.prizeId);
    if (!member || !prize) throw new Error("Member or Prize not found");
    const result: DrawResult = { member, prize, rank: prize.rank };
    await this.drawResultRepo.save(result);
    return result;
  }

  async getResults(): Promise<DrawResult[]> {
    return await this.drawResultRepo.findAll();
  }

  async getScreenContents(): Promise<ScreenContent[]> {
    return await this.screenContentRepo.findAll();
  }
}
