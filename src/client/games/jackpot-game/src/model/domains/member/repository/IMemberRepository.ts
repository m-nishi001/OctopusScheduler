import type { MemberDto } from "../../../applications/member/dto/member-dto";

export interface IMemberRepository {
  fetchMembers(): Promise<MemberDto[]>;
  batchOperations(operations: {
    add: MemberDto[];
    update: MemberDto[];
    delete: string[];
  }): Promise<void>;
}
