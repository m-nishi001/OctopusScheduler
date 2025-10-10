import { injectable, inject } from "tsyringe";
import { GasService } from "../draw/gas-service";
import { MemberDto } from "./member-dto";
import { toMemberDto, toMember } from "./member-mapper";
import { IMemberRepository } from "../../domain/member/member-repository";

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

  async getMemberById(args: { id: string }): Promise<MemberDto | null> {
    const member = await this.repository.getMemberById(args.id);
    return member ? toMemberDto(member) : null;
  }

  async addMembers(args: { members: MemberDto[] }): Promise<void> {
    const addMembers = args.members.map(toMember);
    await this.repository.addMembers(addMembers);
  }

  async updateMembers(args: { members: MemberDto[] }): Promise<void> {
    const updateOps = args.members.map((dto) => ({
      id: dto.id,
      updateFn: () => toMember(dto),
    }));
    await this.repository.updateMembers(updateOps);
  }

  async deleteMembers(args: { ids: string[] }): Promise<void> {
    await this.repository.deleteMembers(args.ids);
  }
}
