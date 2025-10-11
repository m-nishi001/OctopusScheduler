import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { injectable } from "tsyringe";
import type { Member } from "../../domains/member/member";
import type { IMemberRepository } from "../../domains/member/repository/IMemberRepository";

const MEMBER_CACHE_KEY = "members";

@injectable()
export class MemberRepository implements IMemberRepository {
  private readonly gasService =
    GasFunctionService.create("callJackpotGameApi")!;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("MemberData")
  );

  async getMembers(): Promise<Member[]> {
    return (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
  }

  async getMemberById(id: string): Promise<Member | null> {
    const members = await this.getMembers();
    return members.find((m) => m.id === id) || null;
  }

  async addMembers(members: Member[]): Promise<void> {
    const current = await this.getMembers();
    const updated = [...current, ...members];
    await this.localStorage.save(MEMBER_CACHE_KEY, updated);
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
    const current = await this.getMembers();
    const updated = current.map((m) => {
      const update = updates.find((u) => u.id === m.id);
      return update ? update.updateFn(m) : m;
    });
    await this.localStorage.save(MEMBER_CACHE_KEY, updated);
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
    const current = await this.getMembers();
    const updated = current.filter((m) => !ids.includes(m.id));
    await this.localStorage.save(MEMBER_CACHE_KEY, updated);
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
          // サーバーから取得したメンバーをローカルに保存
          const serverMembers = res.members.map((m) => ({
            id: m.id,
            name: m.name,
            photoAssetId: m.photoAssetId,
            attributes: m.attributes,
            order: m.order,
          }));
          await this.localStorage.save(MEMBER_CACHE_KEY, serverMembers);
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
