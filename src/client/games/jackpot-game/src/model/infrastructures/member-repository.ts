import { LocalStorageService } from "@common-lib/storage/local-storage-service";
import { injectable, inject } from "tsyringe";
import { IdGeneratorToken } from "../domains/common/id-generator";
import type { IdGenerator } from "../domains/common/id-generator";
import type { Member } from "../domains/member/member";
import type { IMemberRepository } from "../domains/member/repository/i-member-repository";

@injectable()
export class MemberRepository implements IMemberRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "MemberData"
  );

  constructor(@inject(IdGeneratorToken) private idGenerator: IdGenerator) {}

  async getMembers(): Promise<Member[]> {
    const allMembers = await this.localStorage.getAll<Member>();
    return Array.from(allMembers.values());
  }

  async getMemberById(id: string): Promise<Member | null> {
    return (await this.localStorage.get<Member>(id)) || null;
  }

  async addMembers(members: Member[]): Promise<Member[]> {
    const addedMembers = members.map((member) => ({
      ...member,
      id: this.idGenerator.nextId(),
    }));

    for (const addedMember of addedMembers) {
      await this.localStorage.save(addedMember.id, addedMember);
    }

    return addedMembers;
  }

  async updateMembers(
    updates: { id: string; updateFn: (member: Member) => Member }[]
  ): Promise<void> {
    for (const update of updates) {
      const current = await this.localStorage.get<Member>(update.id);
      if (current) {
        const updated = update.updateFn(current);
        await this.localStorage.save(updated.id, updated);
      }
    }
  }

  async deleteMembers(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
  }

  async replaceAllMembers(members: Member[]): Promise<{ replaced: number }> {
    // clear existing store and save provided members using their ids
    await this.localStorage.clear();
    for (const m of members) {
      const id = m.id || this.idGenerator.nextId();
      await this.localStorage.save(id, { ...m, id });
    }
    return { replaced: members.length };
  }
}
