import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { injectable } from "tsyringe";
import type { Member } from "../../domains/member/member";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { MemberDto } from "../../applications/member/dto/member-dto";
import { fromMember } from "../../applications/member/dto/member-dto";

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

  async addMembers(members: Member[]): Promise<Member[]> {
    if (!this.gasService) return members;

    const memberDtos = members.map(fromMember);

    const ids = await new Promise<string[]>((resolve, reject) => {
      this.gasService!.createCall<string[]>("MemberService.addMembers", {
        members: memberDtos,
      })
        .withSuccessed(resolve)
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });

    // 渡したmembersと返されたidsを組み合わせてローカルストレージに保存
    const addedMembers = members.map((member, index) => ({
      ...member,
      id: ids[index],
    }));

    for (const addedMember of addedMembers) {
      await this.localStorage.save(addedMember.id, addedMember);
    }

    return addedMembers;
  }

  async updateMembers(
    updates: { id: string; updateFn: (member: Member) => Member }[]
  ): Promise<void> {
    if (!this.gasService) return;

    const updatedMembers: Member[] = [];
    for (const update of updates) {
      const current = await this.localStorage.get<Member>(update.id);
      if (current) {
        const updated = update.updateFn(current);
        updatedMembers.push(updated);
      }
    }

    const memberDtos = updatedMembers.map(fromMember);

    await new Promise<void>((resolve, reject) => {
      this.gasService
        .createCall<void>("MemberService.updateMembers", {
          members: memberDtos,
        })
        .withSuccessed(resolve)
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });

    for (const updated of updatedMembers) {
      await this.localStorage.save(updated.id, updated);
    }
  }

  async deleteMembers(ids: string[]): Promise<void> {
    if (!this.gasService) return;

    await new Promise<void>((resolve, reject) => {
      this.gasService
        .createCall<void>("MemberService.deleteMembers", { ids })
        .withSuccessed(resolve)
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });

    await this.localStorage.removeMultiple(ids);
  }

  async syncMembers(): Promise<void> {
    if (!this.gasService) throw new Error("GAS service not available");

    const res = await new Promise<MemberDto[]>((resolve, reject) => {
      this.gasService
        .createCall<MemberDto[]>("MemberService.getMembers")
        .withSuccessed(resolve)
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });

    const serverMembers = res.map((m) => ({
      id: m.id,
      name: m.name,
      photoAssetId: m.photoAssetId,
      rank: m.rank,
    }));

    for (const member of serverMembers) {
      await this.localStorage.save(member.id, member);
    }
  }
}
