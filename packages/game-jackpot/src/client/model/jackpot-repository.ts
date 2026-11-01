import { blobToDataUrl } from "@octopus/client-common/blob/blob-to-data-url";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { inject, injectable } from "tsyringe";
import {
  BLOB_HASH_PATTERN,
  BlobRecordStore,
  HashedBlobStore,
  blobRecordSyncTarget,
  hashBlob,
  mapPool,
  textBlobRecordRemote,
  withHashedBlobs,
} from "@octopus/sync-engine";
import type { HashedBlobRemote, SyncTarget } from "@octopus/sync-engine";
import { deriveMedia, mimeOfName } from "@octopus/table-io";
import { IJackpotGameApiToken, jackpotMediaRefs, jackpotRecordHashes, prizeMediaNames } from "../../server/jackpot-api-contract";
import type { JackpotGameApi, JackpotRecord, MediaInfo, Prize, ScreenSettingRecord } from "../../server/jackpot-api-contract";

const RECORD_SYNC_KIND = "jackpot";
const REMOTE_OPTIONS = { timeout: 180000 };

/** 取り込む素材1つ: 中身とそのハッシュ(`hashBlob`)。 */
export interface ImportedFile {
  blob: Blob;
  hash: string;
}

/** レコードの景品と画面設定(素材の索引を除く)。 */
type Contents = Pick<JackpotRecord, "prizes" | "screens">;

const emptyRecord = (): JackpotRecord => ({ prizes: [], screens: [], media: {} });

/** 端末やサーバーに残っているレコードの形が違っても(以前の形式など)、空のレコードとして扱う。 */
const asRecord = (data: Partial<JackpotRecord> | null | undefined): JackpotRecord =>
  data && Array.isArray(data.prizes) && Array.isArray(data.screens) ? { prizes: data.prizes, screens: data.screens, media: data.media ?? {} } : emptyRecord();

/** データURLを Blob にする。 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

const settingKey = (s: Pick<ScreenSettingRecord, "screenName" | "settingName">) => `${s.screenName}_${s.settingName}`;

/**
 * ジャックポットの景品と画面設定の保存先。正となるのは、この端末(IndexedDB)の「レコード1件」(`{ data, updatedAt }`)だけ。
 * レコード `data` は `{ prizes, screens, media }`。画像・音声は景品と画面設定からファイル名(素材の名前)で参照し、
 * 同じ名前は同じ素材として1つだけ持つ(縮小しない)。
 * `media`(名前 → ハッシュなど)は状態として持たず、レコードを書くたびに景品と画面設定が参照している名前から作り直す(`commit` が唯一の書き込み)。
 * 素材の中身はハッシュを名前にした別の置き場に置く。削除はレコードから外すだけで、サーバーがレコードを書くときに、外れたハッシュのファイルを消す。
 * レコードが正なので、ファイルだけがあって参照が無い、参照先が無い、という状態は作れない。
 */
@injectable()
export class JackpotRepository {
  private readonly list = new BlobRecordStore<JackpotRecord>("jackpot-game", "JackpotData");
  private readonly blobs = new HashedBlobStore("jackpot-game-blobs", "Blobs");

  constructor(@inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi) {}

  /** いまのレコード(景品・画面設定と素材の索引)。 */
  async readRecord(): Promise<JackpotRecord> {
    return asRecord((await this.list.read())?.data);
  }

  /** 素材の名前の中身。登録されていない・まだ手元に無い(同期の途中)なら null。 */
  async blobOf(name: string | null | undefined): Promise<Blob | null> {
    const info = name ? (await this.readRecord()).media[name] : undefined;
    const blob = info ? await this.blobs.get(info.hash) : null;
    // 種類が記録されていない中身には、索引の種類を付ける
    return blob && (blob.type || !info!.mime ? blob : new Blob([blob], { type: info!.mime }));
  }

  async getPrizes(): Promise<Prize[]> {
    return (await this.readRecord()).prizes;
  }

  async getPrizeById(id: string): Promise<Prize | null> {
    return (await this.getPrizes()).find((p) => p.id === id) ?? null;
  }

  async getScreenSettings(): Promise<ScreenSettingRecord[]> {
    return (await this.readRecord()).screens;
  }

  async getScreenSettingsByType(type: string): Promise<ScreenSettingRecord[]> {
    return (await this.getScreenSettings()).filter((s) => s.screenName === type);
  }

  /**
   * レコードを書く唯一の場所。景品と画面設定を `change` で変え、素材の索引を作り直す。
   * 参照先の素材が索引にも `added` にも無ければ、書かずに例外。
   */
  private async commit(change: (current: Contents) => Contents, added: ReadonlyMap<string, MediaInfo> = new Map()): Promise<void> {
    await this.list.update((current) => {
      const record = asRecord(current);
      const next = change(record);
      const known = new Map([...Object.entries(record.media), ...added]);
      return { ...next, media: deriveMedia(jackpotMediaRefs(next), (names) => names, known) };
    });
    eventBus.emit("syncDirty");
  }

  /** 使われる素材だけを端末の置き場に並列に入れ、索引に足す情報を返す(同じ名前は上書き=差し替え)。 */
  private async stage(files: ReadonlyMap<string, Blob>, used: ReadonlySet<string>): Promise<Map<string, MediaInfo>> {
    const staged = await mapPool([...files].filter(([name]) => used.has(name)), async ([name, blob]) => {
      const hash = await hashBlob(blob);
      await this.blobs.put(hash, blob);
      return [name, { hash, mime: blob.type || mimeOfName(name), size: blob.size }] as const;
    });
    return new Map(staged);
  }

  /** 景品を保存する(同じ id があれば置き換え、無ければ末尾に足す)。`files` は、選んだばかりの素材(名前 → 中身)。 */
  async addPrizes(prizes: readonly Prize[], files: ReadonlyMap<string, Blob> = new Map()): Promise<void> {
    const staged = await this.stage(files, new Set(prizes.flatMap(prizeMediaNames)));
    await this.commit((c) => {
      const byId = new Map(c.prizes.map((p) => [p.id, p] as const));
      for (const prize of prizes) byId.set(prize.id, prize);
      return { ...c, prizes: [...byId.values()] };
    }, staged);
  }

  async deletePrizes(ids: readonly string[]): Promise<void> {
    const gone = new Set(ids);
    await this.commit((c) => ({ ...c, prizes: c.prizes.filter((p) => !gone.has(p.id)) }));
  }

  /** 画面設定を保存する(同じ画面名・項目名は置き換え)。`files` は、選んだばかりの素材(名前 → 中身)。 */
  async updateScreenSettings(settings: readonly ScreenSettingRecord[], files: ReadonlyMap<string, Blob> = new Map()): Promise<void> {
    const used = new Set<string>();
    for (const s of settings) for (const name of jackpotMediaRefs({ prizes: [], screens: [s] }).flat()) used.add(name);
    const staged = await this.stage(files, used);
    await this.commit((c) => {
      const byKey = new Map(c.screens.map((s) => [settingKey(s), s] as const));
      for (const s of settings) byKey.set(settingKey(s), s);
      return { ...c, screens: [...byKey.values()] };
    }, staged);
  }

  /**
   * 景品の取り込みを反映する: 新しい素材を端末の置き場に並列に入れ、レコードを1回だけ書く(`next` が取込後の景品の全部)。
   * 送信は通常の同期に任せる(上げてからレコードを書くので、途中までの状態がサーバーに出ることはない)。
   */
  async applyPrizeImport(next: readonly Prize[], newFiles: ReadonlyMap<string, ImportedFile>): Promise<void> {
    const used = new Set(next.flatMap(prizeMediaNames));
    const files = [...newFiles].filter(([name]) => used.has(name));
    await mapPool(files, ([, f]) => this.blobs.put(f.hash, f.blob));
    const staged = new Map(files.map(([name, f]) => [name, { hash: f.hash, mime: f.blob.type || mimeOfName(name), size: f.blob.size }] as const));
    await this.commit((c) => ({ ...c, prizes: [...next] }), staged);
  }

  /**
   * 同期の対象。レコード1件と、それが参照するファイル(上げる → レコード → 取ってくる)。
   * 先にレコードの保存先を1つだけ開いておく。同じデータベースの複数のストアを、同時に初めて開くと、
   * IndexedDB の版の更新が重なって、あとから開いたストアが作られないことがある。
   */
  async listSyncTargets(): Promise<SyncTarget[]> {
    await this.list.read();
    const record = blobRecordSyncTarget(
      RECORD_SYNC_KIND,
      this.list,
      textBlobRecordRemote<JackpotRecord>({
        read: async () => (await this.jackpotApi.getRecord(undefined, REMOTE_OPTIONS)).json,
        write: (json) => this.jackpotApi.saveRecord({ json }, REMOTE_OPTIONS),
      })
    );
    return [
      withHashedBlobs(record, {
        local: this.blobs,
        remote: this.blobRemote(),
        hashesOf: (data) => jackpotRecordHashes(data).filter((h) => BLOB_HASH_PATTERN.test(h)),
      }) as SyncTarget,
    ];
  }

  private blobRemote(): HashedBlobRemote {
    return {
      exists: async (hashes) => (await this.jackpotApi.existsBlobs({ hashes }, REMOTE_OPTIONS)).existing,
      put: async (hash, blob) => this.jackpotApi.putBlob({ hash, dataUrl: await blobToDataUrl(blob) }, REMOTE_OPTIONS),
      get: async (hash) => {
        const { dataUrl } = await this.jackpotApi.getBlob({ hash }, REMOTE_OPTIONS);
        return dataUrl ? dataUrlToBlob(dataUrl) : null;
      },
    };
  }
}
