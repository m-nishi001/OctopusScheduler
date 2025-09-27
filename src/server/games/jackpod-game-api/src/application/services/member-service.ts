
import { injectable, inject } from "tsyringe";
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { Member } from "../../domain/entities/member";
import { GasService } from "./gas-service";

@injectable()
export class MemberService implements GasService {
    readonly serviceName = "MemberService";
    readonly functions: Record<string, (args: any) => any>;

    constructor(@inject("IMemberRepository") private readonly repository: IMemberRepository) {
        this.functions = {
            getAll: this.getAll.bind(this),
            getById: this.getById.bind(this),
            save: this.save.bind(this),
            delete: this.delete.bind(this)
        };
    }

    async getAll(): Promise<Member[]> {
        return this.repository.findAll();
    }

    async getById(args: { id: string }): Promise<Member | null> {
        return this.repository.findById(args.id);
    }

    async save(args: { member: Member }): Promise<void> {
        return this.repository.save(args.member);
    }

    async delete(args: { id: string }): Promise<void> {
        return this.repository.delete(args.id);
    }
}
