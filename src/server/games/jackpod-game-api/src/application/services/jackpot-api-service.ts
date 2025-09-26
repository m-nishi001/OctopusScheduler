import { injectable } from "tsyringe";
import { DrawResult } from "../../domain/entities/draw-result";
import { Member } from "../../domain/entities/member";
import { Prize } from "../../domain/entities/prize";
import { ScreenContent } from "../../domain/entities/screen-content";
import { IDrawResultRepository } from "../../domain/repositories/draw-result-repository";
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { IPrizeRepository } from "../../domain/repositories/prize-repository";
import { IScreenContentRepository } from "../../domain/repositories/screen-content-repository";
import { GasService } from "./gas-service";
import { inject } from "tsyringe";

@injectable()
export class JackpotApiService implements GasService {
    public serviceName = "JackpotApiService";
    public functions: Record<string, (args: any) => any>;

    constructor(
        @inject("IMemberRepository") private memberRepo: IMemberRepository,
        @inject("IPrizeRepository") private prizeRepo: IPrizeRepository,
        @inject("IDrawResultRepository") private drawResultRepo: IDrawResultRepository,
        @inject("IScreenContentRepository") private screenContentRepo: IScreenContentRepository
    ) {
        this.functions = {
            getMembers: this.getMembers.bind(this),
            getPrizes: this.getPrizes.bind(this),
            draw: this.draw.bind(this),
            getResults: this.getResults.bind(this),
            getResult: this.getResult.bind(this),
            saveResult: this.saveResult.bind(this),
            getScreenContents: this.getScreenContents.bind(this),
            getScreenConfig: this.getScreenConfig.bind(this),
            saveScreenConfig: this.saveScreenConfig.bind(this)
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
    const drawId = `${Date.now()}_${member.id}_${prize.id}`;
    const result: DrawResult = { drawId, member, prize, rank: prize.rank };
    await this.drawResultRepo.save(result);
    return result;
    }

    async getResults(): Promise<DrawResult[]> {
        return await this.drawResultRepo.findAll();
    }

        async getResult(drawId: string): Promise<DrawResult | null> {
            return await this.drawResultRepo.findById(drawId);
        }

        async saveResult(result: DrawResult): Promise<void> {
            await this.drawResultRepo.save(result);
        }

    async getScreenContents(): Promise<ScreenContent[]> {
        return await this.screenContentRepo.findAll();
    }

        async getScreenConfig(): Promise<ScreenContent[]> {
            return await this.screenContentRepo.findAll();
        }

        async saveScreenConfig(configs: ScreenContent[]): Promise<void> {
            for (const config of configs) {
                await this.screenContentRepo.save(config);
            }
        }
}
