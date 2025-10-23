import type { Member } from "../member";

// Runtime DI token for IMemberRepository
export const IMemberRepositoryToken = Symbol("IMemberRepository");

export interface IMemberRepository {
  getMembers(): Promise<Member[]>;
  getMemberById(id: string): Promise<Member | null>;
  addMembers(members: Member[]): Promise<Member[]>;
  updateMembers(
    updates: { id: string; updateFn: (member: Member) => Member }[]
  ): Promise<void>;
  deleteMembers(ids: string[]): Promise<void>;
  // Replace all members in the local store with the supplied array.
  // Returns an object with the number of replaced records.
  replaceAllMembers(members: Member[]): Promise<{ replaced: number }>;
}
