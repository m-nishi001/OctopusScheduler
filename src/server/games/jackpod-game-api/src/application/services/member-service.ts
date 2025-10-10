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
      getMemberById: this.getMemberById.bind(this),
      addMembers: this.addMembers.bind(this),
      updateMembers: this.updateMembers.bind(this),
      deleteMembers: this.deleteMembers.bind(this),
    };
  }

  getMemberById(args: { id: string }): MemberDto | null {
    const member = this.repository.findById(args.id);
    return member ? toMemberDto(member) : null;
  }

  addMembers(args: { members: MemberDto[] }): void {
    const addMembers = args.members.map(toMember);
    this.repository.batchOperations({
      add: addMembers,
      update: [],
      delete: [],
    });
  }

  updateMembers(args: { members: MemberDto[] }): void {
    const updateOps = args.members.map((dto) => ({
      id: dto.id,
      updateFn: (m: Member) => toMember(dto),
    }));
    this.repository.batchOperations({
      add: [],
      update: updateOps,
      delete: [],
    });
  }

  deleteMembers(args: { ids: string[] }): void {
    this.repository.batchOperations({
      add: [],
      update: [],
      delete: args.ids,
    });
  }
}
