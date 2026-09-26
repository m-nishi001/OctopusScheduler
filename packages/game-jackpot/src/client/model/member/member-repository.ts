import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { injectable, inject } from "tsyringe";
import { MemberDirectoryRepository } from "@octopus/member-directory";
import type { Member as DirectoryMember } from "@octopus/member-directory";
import type { Member } from "./member";
import type { JackpotMemberExtra } from "./jackpot-member-extra";

const DEFAULT_RANK = 5;
const ROSTER_OVERRIDE_KEY = "override";

/**
 * jackpot固有のメンバーリポジトリ。
 *
 * メンバーのid/nameは `@octopus/member-directory` が持つ共有マスタから取得し、
 * rank/写真といったjackpot固有の設定は `MemberExtraData`(id => JackpotMemberExtra)
 * としてローカルに保持してマージする。
 *
 * `MemberRosterOverride` は動作確認用シミュレーション(draw-simulation-service.ts)が
 * 一時的にダミーメンバーへ差し替えるための、共有マスタに一切影響しないローカル専用の
 * 上書き機構。上書き中は getMembers()/getMemberById() がこの内容のみを返す。
 */
@injectable()
export class MemberRepository {
  private readonly extraStorage = new LocalStorageService("jackpot-game", "MemberExtraData");
  private readonly overrideStorage = new LocalStorageService(
    "jackpot-game",
    "MemberRosterOverride"
  );

  constructor(
    @inject(MemberDirectoryRepository) private readonly directory: MemberDirectoryRepository
  ) {}

  private toMember(directoryMember: DirectoryMember, extra?: JackpotMemberExtra): Member {
    return {
      id: directoryMember.id,
      name: directoryMember.name,
      rank: extra?.rank ?? DEFAULT_RANK,
      photoAssetId: extra?.photoAssetId,
      photoDataUrl: extra?.photoDataUrl,
    };
  }

  async getMembers(): Promise<Member[]> {
    const override = await this.overrideStorage.get<Member[]>(ROSTER_OVERRIDE_KEY);
    if (override) return override;

    const [directoryMembers, extras] = await Promise.all([
      this.directory.listMembers(),
      this.extraStorage.getAll<JackpotMemberExtra>(),
    ]);
    return directoryMembers.map((m) => this.toMember(m, extras.get(m.id)));
  }

  async getMemberById(id: string): Promise<Member | null> {
    const override = await this.overrideStorage.get<Member[]>(ROSTER_OVERRIDE_KEY);
    if (override) return override.find((m) => m.id === id) ?? null;

    const directoryMembers = await this.directory.listMembers();
    const directoryMember = directoryMembers.find((m) => m.id === id);
    if (!directoryMember) return null;
    const extra = await this.extraStorage.get<JackpotMemberExtra>(id);
    return this.toMember(directoryMember, extra);
  }

  /**
   * メンバーを追加する。`member.id` が既存マスタのIDと一致する場合は
   * 既存の共有メンバーへ紐付ける(rank/写真の設定のみ)。一致しない場合は
   * 新規メンバーとして共有マスタに追加してから紐付ける。
   */
  async addMembers(members: Member[]): Promise<Member[]> {
    const existingIds = new Set((await this.directory.listMembers()).map((m) => m.id));
    const added: Member[] = [];
    for (const member of members) {
      const directoryMember =
        member.id && existingIds.has(member.id)
          ? { id: member.id, name: member.name }
          : await this.directory.addMember({ id: member.id || undefined, name: member.name });
      existingIds.add(directoryMember.id);

      const extra: JackpotMemberExtra = {
        memberId: directoryMember.id,
        rank: member.rank,
        photoAssetId: member.photoAssetId,
        photoDataUrl: member.photoDataUrl,
      };
      await this.extraStorage.save(directoryMember.id, extra);
      added.push(this.toMember(directoryMember, extra));
    }
    return added;
  }

  async updateMembers(
    updates: { id: string; updateFn: (member: Member) => Member }[]
  ): Promise<void> {
    for (const update of updates) {
      const current = await this.getMemberById(update.id);
      if (!current) continue;
      const updated = update.updateFn(current);
      if (updated.name !== current.name) {
        await this.directory.updateMember({ id: update.id, name: updated.name });
      }
      const extra: JackpotMemberExtra = {
        memberId: update.id,
        rank: updated.rank,
        photoAssetId: updated.photoAssetId,
        photoDataUrl: updated.photoDataUrl,
      };
      await this.extraStorage.save(update.id, extra);
    }
  }

  /** jackpotのロースターからメンバーを外す(共有マスタからは削除しない)。 */
  async deleteMembers(ids: string[]): Promise<void> {
    await this.extraStorage.removeMultiple(ids);
  }

  /**
   * bulk-sync(Driveバックアップの復元)用。共有マスタへ id ベースでupsertし、
   * ローカル拡張(rank/写真)を渡された内容で置き換える。
   */
  async replaceAllMembers(members: Member[]): Promise<{ replaced: number }> {
    const existingIds = new Set((await this.directory.listMembers()).map((m) => m.id));
    await this.extraStorage.clear();
    for (const member of members) {
      const directoryMember =
        member.id && existingIds.has(member.id)
          ? await this.directory.updateMember({ id: member.id, name: member.name })
          : await this.directory.addMember({ id: member.id || undefined, name: member.name });
      existingIds.add(directoryMember.id);

      const extra: JackpotMemberExtra = {
        memberId: directoryMember.id,
        rank: member.rank,
        photoAssetId: member.photoAssetId,
        photoDataUrl: member.photoDataUrl,
      };
      await this.extraStorage.save(directoryMember.id, extra);
    }
    return { replaced: members.length };
  }

  /**
   * 動作確認シミュレーション用にロースターを一時的にダミーメンバーへ差し替える。
   * 共有マスタには一切書き込まない(他モジュールの名簿を汚さないため)。
   * `clearRosterOverride()` を呼ぶまで getMembers()/getMemberById() はこの内容のみを返す。
   */
  async setRosterOverride(members: Member[]): Promise<void> {
    await this.overrideStorage.save(ROSTER_OVERRIDE_KEY, members);
  }

  /** シミュレーション用の一時的な上書きを解除し、共有マスタ由来の内容に戻す。 */
  async clearRosterOverride(): Promise<void> {
    await this.overrideStorage.delete(ROSTER_OVERRIDE_KEY);
  }
}
