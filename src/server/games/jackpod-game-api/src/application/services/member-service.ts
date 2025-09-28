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

    getAll(): MemberDto[] {
        const members = this.repository.findAll();
        return members.map(toMemberDto);
    }

    getById(args: { id: string }): MemberDto | null {
        const member = this.repository.findById(args.id);
        return member ? toMemberDto(member) : null;
    }

    save(args: { member: MemberDto }): void {
        this.repository.save(toMember(args.member));
    }

    delete(args: { id: string }): void {
        this.repository.delete(args.id);
    }
}
