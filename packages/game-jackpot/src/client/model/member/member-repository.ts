import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { injectable, inject } from "tsyringe";
import { CryptoIdGenerator } from "../common/crypto-id-generator";
import type { Member } from "./member";

@injectable()
export class MemberRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "MemberData"
  );

  constructor(
    @inject(CryptoIdGenerator) private readonly idGenerator: CryptoIdGenerator
  ) {}

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
    await this.localStorage.clear();
    for (const m of members) {
      const id = m.id || this.idGenerator.nextId();
      await this.localStorage.save(id, { ...m, id });
    }
    return { replaced: members.length };
  }
}
