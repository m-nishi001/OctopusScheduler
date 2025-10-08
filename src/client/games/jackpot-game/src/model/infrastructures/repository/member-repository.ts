import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../../infrastructures/storage-config";
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

  async addMembers(members: Member[]): Promise<void> {
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ members: Member[] }>("MemberService.addMembers", {
          members,
        })
        .withSuccessed((res: { members: Member[] }) => {
          this.localStorage.get<Member[]>(MEMBER_CACHE_KEY).then((existing) => {
            const updated = existing
              ? [...existing, ...res.members]
              : res.members;
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

  async updateMembers(members: Member[]): Promise<void> {
    let localMembers =
      (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
    for (const member of members) {
      localMembers = localMembers.map((m: Member) =>
        m.id === member.id ? member : m
      );
    }
    await this.localStorage.save(MEMBER_CACHE_KEY, localMembers);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("MemberService.updateMembers", { members })
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

  async deleteMembers(ids: string[]): Promise<void> {
    let members =
      (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
    members = members.filter((m: Member) => !ids.includes(m.id));
    await this.localStorage.save(MEMBER_CACHE_KEY, members);
    if (!this.gasService) return;
    // サーバー側にdeleteManyがないので、個別に削除
    for (const id of ids) {
      await new Promise<void>((resolve, reject) => {
        this.gasService
          .createCall<void>("MemberService.delete", { id })
          .withSuccessed(() => resolve())
          .withFailuered((msg: string) => reject(new Error(msg)))
          .invoke();
      });
    }
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
}
