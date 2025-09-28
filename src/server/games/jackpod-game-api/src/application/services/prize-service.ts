import { injectable, inject } from "tsyringe";
import { IPrizeRepository } from "../../domain/repositories/prize-repository";
import { GasService } from "./gas-service";
import { PrizeDto } from '../dtos/prize-dto';
import { toPrizeDto, toPrize } from '../dtos/prize-mapper';

@injectable()
export class PrizeService implements GasService {
    readonly serviceName = "PrizeService";
    readonly functions: Record<string, (args: any) => any>;

    constructor(@inject("IPrizeRepository") private readonly repository: IPrizeRepository) {
        this.functions = {
            getAll: this.getAll.bind(this),
            getById: this.getById.bind(this),
            save: this.save.bind(this),
            delete: this.delete.bind(this)
        };
    }

    async getAll(): Promise<PrizeDto[]> {
        const prizes = await this.repository.findAll();
        return prizes.map(toPrizeDto);
    }

    async getById(args: { id: string }): Promise<PrizeDto | null> {
        const prize = await this.repository.findById(args.id);
        return prize ? toPrizeDto(prize) : null;
    }

    async save(args: { prize: PrizeDto }): Promise<void> {
        return this.repository.save(toPrize(args.prize));
    }

    async delete(args: { id: string }): Promise<void> {
        return this.repository.delete(args.id);
    }
}
