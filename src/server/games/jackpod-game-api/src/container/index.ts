import { container } from "tsyringe";
import { JackpotApiService } from "../application/services/jackpot-api-service";
import { IMemberRepository } from "../domain/repositories/member-repository";
import { MemberRepository } from "../infrastructure/repositories/member-repository";
import { IPrizeRepository } from "../domain/repositories/prize-repository";
import { PrizeRepository } from "../infrastructure/repositories/prize-repository";

import { GasService } from "../application/services/gas-service";
import { IDrawResultRepository } from "../domain/repositories/draw-result-repository";
import { DrawResultRepository } from "../infrastructure/repositories/draw-result-repository";
import { IScreenContentRepository } from "../domain/repositories/screen-content-repository";
import { ScreenContentRepository } from "../infrastructure/repositories/screen-content-repository";

export class Container {
    static register() {
        container.register<GasService>("IGasService", { useClass: JackpotApiService });

        container.register<IMemberRepository>("IMemberRepository", { useClass: MemberRepository });
        container.register<IPrizeRepository>("IPrizeRepository", { useClass: PrizeRepository });
        container.register<IDrawResultRepository>("IDrawResultRepository", { useClass: DrawResultRepository });
        container.register<IScreenContentRepository>("IScreenContentRepository", { useClass: ScreenContentRepository });
    }
}
