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

  async syncMembers(): Promise<void> {
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ members: Member[] }>("MemberService.getAll")
        .withSuccessed(async (res: { members: Member[] }) => {
          await this.localStorage.save(MEMBER_CACHE_KEY, res.members);
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async batchOperations(operations: {
    add: Member[];
    update: Member[];
    delete: string[];
  }): Promise<void> {
    let localMembers =
      (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
    localMembers = [...localMembers, ...operations.add];
    for (const member of operations.update) {
      localMembers = localMembers.map((m: Member) =>
        m.id === member.id ? member : m
      );
    }
    localMembers = localMembers.filter(
      (m: Member) => !operations.delete.includes(m.id)
    );
    await this.localStorage.save(MEMBER_CACHE_KEY, localMembers);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("MemberService.batchOperations", { operations })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
