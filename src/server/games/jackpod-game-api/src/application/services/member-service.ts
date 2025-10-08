import { injectable, inject } from "tsyringe";
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { GasService } from "./gas-service";
import { MemberDto } from "../dtos/member.dto";
import { Member } from "../../domain/entities/member";
import { toMemberDto, toMember } from "../dtos/member.mapper";

@injectable()
export class MemberService implements GasService {
  readonly serviceName = "MemberService";
  readonly functions: Record<string, (args: any) => any>;

  constructor(
    @inject("IMemberRepository") private readonly repository: IMemberRepository
  ) {
    this.functions = {
      getAll: this.getAll.bind(this),
      getById: this.getById.bind(this),
      batchOperations: this.batchOperations.bind(this),
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

  batchOperations(args: {
    operations: {
      add: MemberDto[];
      update: MemberDto[];
      delete: string[];
    };
  }): void {
    const addMembers = args.operations.add.map(toMember);
    const updateOps = args.operations.update.map((dto) => ({
      id: dto.id,
      updateFn: (m: Member) => toMember(dto),
    }));
    const deleteIds = args.operations.delete;
    this.repository.batchOperations({
      add: addMembers,
      update: updateOps,
      delete: deleteIds,
    });
  }
}
