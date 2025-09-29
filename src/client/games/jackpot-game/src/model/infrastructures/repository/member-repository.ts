import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { injectable } from "tsyringe";
import type { Member } from "../../domains/member/member";
import type { IMemberRepository } from "../../domains/member/repository/IMemberRepository";

const MEMBER_CACHE_KEY = "members";

@injectable()
export class MemberRepository implements IMemberRepository {
  /** 差分更新: 変更・新規・削除のみ反映 */
  async saveMembers(newMembers: Member[]): Promise<void> {
    const oldMembers =
      (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
    // 新規・更新
    for (const member of newMembers) {
      const prev = oldMembers.find((m) => m.id === member.id);
      if (!prev) {
        // 新規追加はサーバー保存→ID受信→ローカル保存
        await this.addMember(member);
      } else if (JSON.stringify(prev) !== JSON.stringify(member)) {
        await this.updateMember(member);
      }
    }
    // 削除
    for (const old of oldMembers) {
      if (!newMembers.find((m) => m.id === old.id)) {
        await this.deleteMember(old.id);
      }
    }
  }
  private readonly gasService =
    GasFunctionService.create("callJackpotGameApi")!;
  private readonly localStorage = useLocalStorage();

  async fetchMembers(): Promise<Member[]> {
    const cached = await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY);
    if (cached && cached.length > 0) {
      return cached;
    }
    if (!this.gasService) return [];
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ members: Member[] }>("MemberService.getAll")
        .withSuccessed((res: { members: Member[] }) => {
          this.localStorage.save(MEMBER_CACHE_KEY, res.members);
          resolve(res.members);
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async addMember(member: Member): Promise<void> {
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ member: Member }>("MemberService.addMember", { member })
        .withSuccessed((res: { member: Member }) => {
          // サーバーから返却されたID付きメンバーでローカル保存
          this.localStorage.get<Member[]>(MEMBER_CACHE_KEY).then((members) => {
            const updated = members ? [...members, res.member] : [res.member];
            this.localStorage
              .save(MEMBER_CACHE_KEY, updated)
              .then(() => resolve());
          });
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async updateMember(member: Member): Promise<void> {
    let members =
      (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
    members = members.map((m: Member) => (m.id === member.id ? member : m));
    await this.localStorage.save(MEMBER_CACHE_KEY, members);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("MemberService.updateMember", { member })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async deleteMember(memberId: string): Promise<void> {
    let members =
      (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
    members = members.filter((m: Member) => m.id !== memberId);
    await this.localStorage.save(MEMBER_CACHE_KEY, members);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("MemberService.delete", { id: memberId })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async syncMembersWithServer(): Promise<Member[]> {
    if (!this.gasService) return [];
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ members: Member[] }>("MemberService.getAll")
        .withSuccessed((res: { members: Member[] }) => {
          this.localStorage.save(MEMBER_CACHE_KEY, res.members);
          resolve(res.members);
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async saveMember(member: Member): Promise<void> {
    await this.addMember(member);
  }
}
