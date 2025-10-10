import { injectable, inject } from "tsyringe";
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { GasService } from "./gas-service";
import { MemberDto } from "../dtos/member.dto";
import { toMemberDto, toMember } from "../mappers/member.mapper";

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
    const member = this.repository.getMemberById(args.id);
    return member ? toMemberDto(member) : null;
  }

  addMembers(args: { members: MemberDto[] }): void {
    const addMembers = args.members.map(toMember);
    this.repository.addMembers(addMembers);
  }

  updateMembers(args: { members: MemberDto[] }): void {
    const updateOps = args.members.map((dto) => ({
      id: dto.id,
      updateFn: () => toMember(dto),
    }));
    this.repository.updateMembers(updateOps);
  }

  deleteMembers(args: { ids: string[] }): void {
    this.repository.deleteMembers(args.ids);
  }
}
