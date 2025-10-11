import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { injectable } from "tsyringe";
import type { Member } from "../../domains/member/member";
import type { IMemberRepository } from "../../domains/member/repository/IMemberRepository";

@injectable()
export class MemberRepository implements IMemberRepository {
  private readonly gasService =
    GasFunctionService.create("callJackpotGameApi")!;
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

  async addMembers(members: Member[]): Promise<void> {
    for (const member of members) {
      await this.localStorage.save(member.id, member);
    }
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("MemberService.addMembers", { members })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async updateMembers(
    updates: { id: string; updateFn: (member: Member) => Member }[]
  ): Promise<void> {
    for (const update of updates) {
      const current = await this.localStorage.get<Member>(update.id);
      if (current) {
        const updated = update.updateFn(current);
        await this.localStorage.save(update.id, updated);
      }
    }
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("MemberService.updateMembers", { updates })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async deleteMembers(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("MemberService.deleteMembers", { ids })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async syncMembers(): Promise<void> {
    if (!this.gasService) throw new Error("GAS service not available");
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ members: any[] }>("MemberService.getMembers")
        .withSuccessed(async (res: { members: any[] }) => {
          const serverMembers = res.members.map((m) => ({
            id: m.id,
            name: m.name,
            photoAssetId: m.photoAssetId,
            attributes: m.attributes,
            order: m.order,
          }));
          for (const member of serverMembers) {
            await this.localStorage.save(member.id, member);
          }
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
