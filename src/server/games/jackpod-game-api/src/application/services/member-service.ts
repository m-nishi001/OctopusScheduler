import { injectable, inject } from "tsyringe";
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { GasService } from "./gas-service";
import { MemberDto } from "../dtos/member.dto";
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
      addMember: this.addMember.bind(this),
      addMembers: this.addMembers.bind(this),
      updateMember: this.updateMember.bind(this),
      updateMembers: this.updateMembers.bind(this),
      delete: this.delete.bind(this),
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

  addMember(args: { member: MemberDto }): { member: MemberDto } {
    const saved = this.repository.add(toMember(args.member));
    return { member: toMemberDto(saved) };
  }

  addMembers(args: { members: MemberDto[] }): { members: MemberDto[] } {
    const saved = this.repository.addMany(args.members.map(toMember));
    return { members: saved.map(toMemberDto) };
  }

  updateMember(args: { member: MemberDto }): void {
    this.repository.update(args.member.id, (m) => toMember(args.member));
  }

  updateMembers(args: { members: MemberDto[] }): void {
    for (const member of args.members) {
      this.repository.update(member.id, (m) => toMember(member));
    }
  }

  delete(args: { id: string }): void {
    this.repository.delete(args.id);
  }
}
