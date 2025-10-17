import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { injectable } from "tsyringe";
import type { Member } from "../../domains/member/member";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";

declare const google: any;

@injectable()
export class MemberRepository implements IMemberRepository {
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("MemberData")
  );

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
      id: crypto.randomUUID(),
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

  async syncMembers(): Promise<{ synced: number }> {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((data: any) => {
          if (data) {
            const serverMembers = data.data.map((row: any[]) => ({
              id: row[0],
              name: row[1],
              photoAssetId: row[2],
              rank: row[3],
            }));
            for (const member of serverMembers) {
              this.localStorage.save(member.id, member);
            }
            resolve({ synced: serverMembers.length });
          } else {
            resolve({ synced: 0 });
          }
        })
        .withFailureHandler((error: any) => reject(new Error(error)))
        .getSpreadsheetData("Members");
    });
  }
}
