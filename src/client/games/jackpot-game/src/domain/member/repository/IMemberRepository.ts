import type { MemberDto } from "../../../applications/member/dto/member-dto";

export interface IMemberRepository {
  getMembers(): Promise<MemberDto[]>;
  syncMembers(): Promise<void>;
  batchOperations(operations: {
    add: MemberDto[];
    update: MemberDto[];
    delete: string[];
  }): Promise<void>;
}
