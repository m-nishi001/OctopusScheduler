import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { DirtyTracker } from "@octopus/sync-engine";
import type { SyncTarget } from "@octopus/sync-engine";
import { injectable, inject } from "tsyringe";
import { MemberDirectoryRepository } from "@octopus/member-directory";
import type { Member as DirectoryMember } from "@octopus/member-directory";
import type { Member } from "./member";
import type { JackpotMemberExtra } from "./jackpot-member-extra";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import type { JackpotGameApi } from "../../../server/jackpot-api-contract";
import type { DriveJsonData } from "@octopus/infrastructures/compositions";

const DEFAULT_RANK = 5;
const ROSTER_OVERRIDE_KEY = "override";
const SYNC_KIND = "member-extras";
const DRIVE_FILE_NAME = "member-extras.json";
// getJsonBlobの「fileId省略時は既定ファイル(prizes.json)」というフォールバックは
// このファイル名には効かないため、pushで得たfileId(フルキー)をこのブラウザに
// 保存しておき、次回以降はそれを明示的に渡す。screens(ScreenConfigRepository)
// と同じ制約: このfileIdをまだ知らない別デバイスからは、他デバイスが既に
// アップロード済みのmember-extrasを初回pullで見つけられない。
const DRIVE_FILE_ID_STORAGE_KEY = "jackpot-member-extras-file-id";

/**
 * jackpot固有のメンバーリポジトリ。
 *
 * メンバーのid/nameは `@octopus/member-directory` が持つ共有マスタから取得し、
 * rank/写真といったjackpot固有の設定は `MemberExtraData`(id => JackpotMemberExtra)
 * としてローカルに保持してマージする。id/nameは共有マスタへの書き込みで
 * 即座に他デバイスへ反映されるため、バックグラウンド同期の対象はjackpot固有の
 * 拡張設定(rank/写真)のみでよい。
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
  private readonly dirtyTracker = new DirtyTracker("jackpot-game");

  constructor(
    @inject(MemberDirectoryRepository) private readonly directory: MemberDirectoryRepository,
    @inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi
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
    await this.dirtyTracker.touch(SYNC_KIND);
    eventBus.emit("syncDirty");
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
    await this.dirtyTracker.touch(SYNC_KIND);
    eventBus.emit("syncDirty");
  }

  /** jackpotのロースターからメンバーを外す(共有マスタからは削除しない)。 */
  async deleteMembers(ids: string[]): Promise<void> {
    await this.extraStorage.removeMultiple(ids);
    await this.dirtyTracker.touch(SYNC_KIND);
    eventBus.emit("syncDirty");
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

  /**
   * バックグラウンド同期エンジン向けに、jackpot固有のメンバー拡張設定
   * (rank/写真)一覧を1つのSyncTargetとして返す。id/nameは共有マスタ経由で
   * 既に常に最新のため、ここでの同期対象には含めない。
   */
  async listSyncTargets(): Promise<SyncTarget<JackpotMemberExtra[], JackpotMemberExtra[]>[]> {
    const target: SyncTarget<JackpotMemberExtra[], JackpotMemberExtra[]> = {
      id: SYNC_KIND,
      kind: SYNC_KIND,
      getLocal: async () => {
        const extras = Array.from((await this.extraStorage.getAll<JackpotMemberExtra>()).values());
        if (extras.length === 0) return null;
        const trackedAt = await this.dirtyTracker.getUpdatedAt(SYNC_KIND);
        return { data: extras, updatedAt: trackedAt ?? Date.now() };
      },
      getRemote: async () => {
        const storedFileId = localStorage.getItem(DRIVE_FILE_ID_STORAGE_KEY) || undefined;
        if (!storedFileId) return null;
        let resp;
        try {
          resp = await this.jackpotApi.getJson(storedFileId);
        } catch (e) {
          console.error(
            "[MemberRepository] Failed to fetch remote member extras for sync",
            e
          );
          return null;
        }
        let parsed: JackpotMemberExtra[];
        try {
          parsed = JSON.parse(resp.json) as JackpotMemberExtra[];
        } catch {
          return null;
        }
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        const updatedAt = resp.updatedAt ? new Date(resp.updatedAt).getTime() : 0;
        return { data: parsed, updatedAt };
      },
      push: async (extras) => {
        const driveJson: DriveJsonData = {
          metadata: {} as any,
          fileName: DRIVE_FILE_NAME,
          jsonText: JSON.stringify(extras),
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        };
        const meta = await this.jackpotApi.addJson(driveJson);
        if (meta?.fileId) {
          localStorage.setItem(DRIVE_FILE_ID_STORAGE_KEY, meta.fileId);
        }
        const updatedAt = meta?.lastUpdate
          ? new Date(meta.lastUpdate).getTime()
          : Date.now();
        await this.dirtyTracker.touch(SYNC_KIND, updatedAt);
        return { updatedAt };
      },
      pull: async (extras) => {
        const keys = Array.from((await this.extraStorage.getAll()).keys());
        if (keys.length) await this.extraStorage.removeMultiple(keys);
        for (const extra of extras) {
          await this.extraStorage.save(extra.memberId, extra);
        }
        const updatedAt = Date.now();
        await this.dirtyTracker.touch(SYNC_KIND, updatedAt);
        return { updatedAt };
      },
    };
    return [target];
  }
}
