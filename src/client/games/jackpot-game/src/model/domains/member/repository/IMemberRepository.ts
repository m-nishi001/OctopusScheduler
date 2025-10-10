import type { Member } from "../member";

export interface IMemberRepository {
  getMembers(): Member[];
  getMemberById(id: string): Member | null;
  addMembers(members: Member[]): void;
  updateMembers(
    updates: { id: string; updateFn: (member: Member) => Member }[]
  ): void;
  deleteMembers(ids: string[]): void;
}
