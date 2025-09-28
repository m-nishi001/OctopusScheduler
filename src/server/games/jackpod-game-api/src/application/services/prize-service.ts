import { injectable, inject } from "tsyringe";
import { IPrizeRepository } from "../../domain/repositories/prize-repository";
import { GasService } from "./gas.service";
import { PrizeDto } from '../dtos/prize.dto';
import { toPrizeDto, toPrize } from '../dtos/prize.mapper';

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

    getAll(): PrizeDto[] {
        const prizes = this.repository.findAll();
        return prizes.map(toPrizeDto);
    }

    getById(args: { id: string }): PrizeDto | null {
        const prize = this.repository.findById(args.id);
        return prize ? toPrizeDto(prize) : null;
    }

    save(args: { prize: PrizeDto }): void {
        this.repository.save(toPrize(args.prize));
    }

    delete(args: { id: string }): void {
        this.repository.delete(args.id);
    }
}
