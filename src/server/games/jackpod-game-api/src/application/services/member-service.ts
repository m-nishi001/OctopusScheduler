import { injectable, inject } from "tsyringe";
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { GasService } from "./gas-service";
import { MemberDto } from '../dtos/member-dto';
import { toMemberDto, toMember } from '../dtos/member-mapper';

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

    async getAll(): Promise<MemberDto[]> {
        const members = await this.repository.findAll();
        return members.map(toMemberDto);
    }

    async getById(args: { id: string }): Promise<MemberDto | null> {
        const member = await this.repository.findById(args.id);
        return member ? toMemberDto(member) : null;
    }

    async save(args: { member: MemberDto }): Promise<void> {
        return this.repository.save(toMember(args.member));
    }

    async delete(args: { id: string }): Promise<void> {
        return this.repository.delete(args.id);
    }
}
