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
      getMembers: this.getMembers.bind(this),
      addMembers: this.addMembers.bind(this),
      updateMembers: this.updateMembers.bind(this),
      deleteMembers: this.deleteMembers.bind(this),
      batchOperations: this.batchOperations.bind(this),
    };
  }

  getMembers(): MemberDto[] {
    const members = this.repository.getMembers();
    return members.map(toMemberDto);
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

  batchOperations(args: {
    add: MemberDto[];
    update: MemberDto[];
    delete: string[];
  }): void {
    if (args.add.length > 0) {
      this.addMembers({ members: args.add });
    }
    if (args.update.length > 0) {
      this.updateMembers({ members: args.update });
    }
    if (args.delete.length > 0) {
      this.deleteMembers({ ids: args.delete });
    }
  }
}
