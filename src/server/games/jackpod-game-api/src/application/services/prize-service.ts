
import { injectable, inject } from "tsyringe";
import { IPrizeRepository } from "../../domain/repositories/prize-repository";
import { Prize } from "../../domain/entities/prize";
import { GasService } from "./gas-service";

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

    async getAll(): Promise<Prize[]> {
        return this.repository.findAll();
    }

    async getById(args: { id: string }): Promise<Prize | null> {
        return this.repository.findById(args.id);
    }

    async save(args: { prize: Prize }): Promise<void> {
        return this.repository.save(args.prize);
    }

    async delete(args: { id: string }): Promise<void> {
        return this.repository.delete(args.id);
    }
}
