import type { Member } from "../member";

export interface IMemberRepository {
  getMembers(): Promise<Member[]>;
  getMemberById(id: string): Promise<Member | null>;
  addMembers(members: Member[]): Promise<Member[]>;
  updateMembers(
    updates: { id: string; updateFn: (member: Member) => Member }[]
  ): Promise<void>;
  deleteMembers(ids: string[]): Promise<void>;
  syncMembers(): Promise<{ synced: number }>;
}
