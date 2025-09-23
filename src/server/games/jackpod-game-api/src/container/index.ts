import { container } from "tsyringe";
import { JackpodGasService } from "../application/services/jackpod-gas-service";
import { IMemberRepository } from "../domain/repositories/member-repository";
import { MemberRepository } from "../infrastructure/repositories/member-repository";
import { IPrizeRepository } from "../domain/repositories/prize-repository";
import { PrizeRepository } from "../infrastructure/repositories/prize-repository";

export class Container {
    static regiser() {
        container.register<JackpodGasService>("IJackpodGasService", { useClass: JackpodGasService });
        container.register<IMemberRepository>("IMemberRepository", { useClass: MemberRepository });
        container.register<IPrizeRepository>("IPrizeRepository", { useClass: PrizeRepository });
    }
}
