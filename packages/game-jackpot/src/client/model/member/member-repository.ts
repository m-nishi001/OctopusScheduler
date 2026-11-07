import { eventBus } from "@octopus/client-common/events/event-bus";
import { BlobRecordStore, blobRecordSyncTarget, textBlobRecordRemote } from "@octopus/sync-engine";
import type { SyncTarget } from "@octopus/sync-engine";
import { injectable, inject } from "tsyringe";
import { AccountsRepository } from "@octopus/accounts";
import type { Member as DirectoryMember } from "@octopus/accounts";
import type { Member } from "./member";
import type { JackpotMemberExtra } from "./jackpot-member-extra";
import { JACKPOT_SCHEMA_VERSION, migrateMemberExtraData } from "../schema-migration";
import type { MemberExtraData } from "../schema-migration";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import type { JackpotGameApi } from "../../../server/jackpot-api-contract";

const SYNC_KIND = "member-extras";
const DRIVE_FILE_NAME = "member-extras.json";

/**
 * jackpot固有のメンバーリポジトリ。
 *
 * メンバーのid/nameは `@octopus/accounts` が持つ共有マスタから取得し、
 * 当選しやすさ(weight)といったjackpot固有の設定は `MemberExtraData`(一覧全体を1件のレコード `{ data: { schemaVersion, extras }, updatedAt }`)
 * としてローカルに保持してマージする。id/nameは共有マスタへの書き込みで
 * 即座に他デバイスへ反映されるため、バックグラウンド同期の対象はjackpot固有の
 * 拡張設定(weight)のみでよい。
 *
 * `MemberRosterOverride` は動作確認用シミュレーション(draw-simulation-service.ts)が
 * 一時的にダミーメンバーへ差し替えるための、共有マスタに一切影響しないローカル専用の
 * 上書き機構。上書き中は getMembers()/getMemberById() がこの内容のみを返す。
 */
@injectable()
export class MemberRepository {
  private readonly extraStore = new BlobRecordStore<MemberExtraData>("jackpot-game", "MemberExtraData");

  constructor(
    @inject(AccountsRepository) private readonly directory: AccountsRepository,
    @inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi
  ) {}

  private toMember(directoryMember: DirectoryMember, extra?: JackpotMemberExtra): Member {
    return {
      id: directoryMember.id,
      name: directoryMember.name,
      weight: extra?.weight,
      photo: directoryMember.photo,
    };
  }

  /**
   * 保存してあるメンバー拡張設定(weight)を、memberId をキーにした Map で返す。
   * 古い版(版が無い・以前の配列形式)が残っていれば、ここで1回だけ初期値(当選しやすさ5)に戻して保存し直す。
   */
  async readExtras(): Promise<Map<string, JackpotMemberExtra>> {
    const record = await this.extraStore.read();
    const { data, changed } = migrateMemberExtraData(record?.data);
    if (changed) {
      await this.extraStore.update((current) => migrateMemberExtraData(current).data);
      eventBus.emit("syncDirty");
    }
    return new Map(data.extras.map((e) => [e.memberId, e] as const));
  }

  /** メンバー拡張設定をまとめて保存する(同期の記録の更新日時も一緒に1回で書く)。 */
  private async saveExtras(change: (extras: Map<string, JackpotMemberExtra>) => void): Promise<void> {
    await this.extraStore.update((current) => {
      const extras = new Map(migrateMemberExtraData(current).data.extras.map((e) => [e.memberId, e] as const));
      change(extras);
      return { schemaVersion: JACKPOT_SCHEMA_VERSION, extras: Array.from(extras.values()) };
    });
    eventBus.emit("syncDirty");
  }

  async getMembers(): Promise<Member[]> {
    const [directoryMembers, extras] = await Promise.all([this.directory.listMembers(), this.readExtras()]);
    return directoryMembers.map((m) => this.toMember(m, extras.get(m.id)));
  }

  async getMemberById(id: string): Promise<Member | null> {
    const directoryMembers = await this.directory.listMembers();
    const directoryMember = directoryMembers.find((m) => m.id === id);
    if (!directoryMember) return null;
    const extra = (await this.readExtras()).get(id);
    return this.toMember(directoryMember, extra);
  }

  /**
   * メンバーを追加する。`member.id` が既存マスタのIDと一致する場合は
   * 既存の共有メンバーへ紐付ける(weightの設定のみ)。一致しない場合は
   * 新規メンバーとして共有マスタに追加してから紐付ける。
   */
  async addMembers(members: Member[]): Promise<Member[]> {
    const existingIds = new Set((await this.directory.listMembers()).map((m) => m.id));
    const added: Member[] = [];
    const extras: JackpotMemberExtra[] = [];
    for (const member of members) {
      const directoryMember =
        member.id && existingIds.has(member.id)
          ? { id: member.id, name: member.name }
          : await this.directory.addMember({ id: member.id || undefined, name: member.name });
      existingIds.add(directoryMember.id);

      const extra: JackpotMemberExtra = {
        memberId: directoryMember.id,
        weight: member.weight,
      };
      extras.push(extra);
      added.push(this.toMember(directoryMember, extra));
    }
    await this.saveExtras((all) => extras.forEach((e) => all.set(e.memberId, e)));
    return added;
  }

  /**
   * 名簿にいるメンバーの当選しやすさを、id をキーにまとめて設定する(省略した項目は今の値を保つ)。
   * 名簿にいない id は何もせず、その id を返す(メンバーの作成は名簿の仕事)。保存・同期の記録は1回だけ。
   */
  async setExtras(rows: { id: string; weight?: number }[]): Promise<{ updated: number; unknown: string[] }> {
    const directoryMembers = await this.directory.listMembers();
    const known = new Set(directoryMembers.map((m) => m.id));
    const unknown: string[] = [];
    let updated = 0;
    const changes: { id: string; weight?: number }[] = [];
    for (const row of rows) {
      if (!known.has(row.id)) {
        unknown.push(row.id);
        continue;
      }
      changes.push(row);
      updated++;
    }
    if (updated > 0) {
      await this.saveExtras((all) => {
        for (const row of changes) {
          const current = all.get(row.id);
          all.set(row.id, {
            memberId: row.id,
            weight: row.weight ?? current?.weight,
          });
        }
      });
    }
    return { updated, unknown };
  }

  async updateMembers(
    updates: { id: string; updateFn: (member: Member) => Member }[]
  ): Promise<void> {
    const extras: JackpotMemberExtra[] = [];
    for (const update of updates) {
      const current = await this.getMemberById(update.id);
      if (!current) continue;
      const updated = update.updateFn(current);
      if (updated.name !== current.name) {
        await this.directory.updateMember({ id: update.id, name: updated.name });
      }
      extras.push({ memberId: update.id, weight: updated.weight });
    }
    await this.saveExtras((all) => extras.forEach((e) => all.set(e.memberId, e)));
  }

  /**
   * メンバーのジャックポット固有の設定（当選しやすさ）を初期値に戻す。
   * 共有マスタ（名簿）からは削除しない。メンバーは名簿にいる限り、ジャックポットのメンバーでもある。
   */
  async deleteMembers(ids: string[]): Promise<void> {
    await this.saveExtras((all) => ids.forEach((id) => all.delete(id)));
  }

  /**
   * バックグラウンド同期エンジン向けに、jackpot固有のメンバー拡張設定
   * (weight)一覧を1つのSyncTargetとして返す。id/nameは共有マスタ経由で
   * 既に常に最新のため、ここでの同期対象には含めない。
   */
  async listSyncTargets(): Promise<SyncTarget<MemberExtraData, MemberExtraData>[]> {
    return [
      blobRecordSyncTarget(
        SYNC_KIND,
        this.extraStore,
        textBlobRecordRemote<MemberExtraData>({
          read: async () => (await this.jackpotApi.getJson(DRIVE_FILE_NAME)).json,
          write: (json) => this.jackpotApi.addJson({ fileName: DRIVE_FILE_NAME, json }),
        })
      ),
    ];
  }
}
