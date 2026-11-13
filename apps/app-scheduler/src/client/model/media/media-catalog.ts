import type { DriveMetadata } from "@octopus/infrastructures/compositions";
import { StorageKind, StorageModule, storageNamespace } from "@octopus/infrastructures/compositions";
import type { AssetRecordEntry } from "../../../server/scheduler-api-contract";
import { classifyMedia, type MediaKind } from "./media-kind";
import { MEDIA_NS } from "./media-command";

/** 管理端末の一覧に出す素材 1 件。 */
export interface CatalogItem {
  id: string;
  /** 表示名(拡張子つき)。サーバーが返さないときは id。 */
  name: string;
  kind: MediaKind;
  /** 素材置き場直下のサブフォルダ名。置き場直下なら空。 */
  folder: string;
}

const ROOT = storageNamespace(StorageModule.Scheduler, StorageKind.Assets);

/** 素材の置き場所(`parentFolderId`)から、サブフォルダ名を取り出す。置き場直下や、ほかの場所なら空。 */
export function folderOf(parentFolderId: string | undefined): string {
  const prefix = `${ROOT}/`;
  if (!parentFolderId?.startsWith(prefix)) return "";
  return parentFolderId.slice(prefix.length).split("/")[0];
}

/** サーバーの一覧(本体は取らない)から、管理端末の一覧を作る。名前順。 */
export function toCatalog(metas: readonly DriveMetadata[]): CatalogItem[] {
  return metas
    .filter((m) => m?.driveDataId)
    .map((m) => {
      const name = m.fileName?.trim() || m.driveDataId;
      return { id: m.driveDataId, name, kind: classifyMedia(undefined, m.fileName), folder: folderOf(m.parentFolderId) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** 画像が入っているサブフォルダの名前(スライドショーに使える)。名前順。 */
export function listFolders(items: readonly CatalogItem[]): string[] {
  return [...new Set(items.filter((i) => i.kind === "image" && i.folder).map((i) => i.folder))].sort((a, b) => a.localeCompare(b));
}

/** この端末(ホスト)の素材の一覧から、一覧の項目を作る。サーバーの一覧(`toCatalog`)と同じ決め方なので、同じ素材は同じ項目になる。 */
export function fromEntries(entries: readonly AssetRecordEntry[]): CatalogItem[] {
  return toCatalog(
    entries.map((e) => ({ driveDataId: e.id, fileId: "", parentFolderId: e.directoryId ?? "", lastUpdate: e.lastUpdated, fileName: e.name }))
  );
}

/**
 * ホストが、ルーム状態の `media` に載せる、素材の一覧の差分。
 * サーバーの一覧は管理端末が自分で読むので、ここにはサーバーとの差(ホストにだけある素材と、ホストが消したがサーバーに残っている素材)だけを載せる。
 * ルーム状態は全体で `MAX_STATE_BYTES`(6000バイト)までなので、載せきれない分は件数だけ `truncated` で知らせる。
 */
export interface HostMediaSlice {
  /** ローカルの一覧かサーバーとの同期が変わるたびに増える番号。変わったら、管理端末はサーバーの一覧を読み直す。 */
  rev: number;
  /** ホストにあって、サーバーにまだ無い素材(アップロード前)。 */
  pending: CatalogItem[];
  /** ホストで消したが、サーバーにまだ残っている素材の id(同期のあとにホストで消したものだけ)。 */
  removedIds: string[];
  /** 容量の都合で載せきれなかった件数(`pending` と `removedIds` の合計)。 */
  truncated: number;
  /** ホストで再生・表示できなかった素材(`at` は時刻 ms。新しい失敗ほど大きい)。 */
  lastError?: { assetId: string; at: number };
}

/** この名前空間(`media`)に、ルーム状態の 6000 バイトのうち割り当てる大きさ。ほかの名前空間(画面・イベント・クイズ・ジャックポット・結果)の分を残す、安全側の値。 */
export const MEDIA_SLICE_BUDGET_BYTES = 1800;
/** `rev`・`truncated`・`lastError` と括弧など、項目以外の分(最大の見積もり)。 */
const SLICE_OVERHEAD_BYTES = 200;

const jsonBytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

/**
 * ホストの一覧(local)とサーバーの一覧(remote)の差を、`budgetBytes` に収まるように作る。
 * `synced` は、最後の同期のとき、ホストとサーバーの両方にあった素材の id。サーバーにあってホストに無い素材のうち、
 * ホストで消したと言えるのは、これに入っているものだけ(入っていないものは、他の端末が足した素材で、ホストがまだ取り込んでいないだけ)。
 * 載せる優先は、ホストにだけある素材(使えるようにするため)、次に消えた素材。名前順(id 順)に収まるだけ載せ、残りは `truncated` に数える。
 */
export function diffPending(
  local: readonly CatalogItem[],
  remote: readonly CatalogItem[],
  budgetBytes: number,
  synced: ReadonlySet<string>
): Pick<HostMediaSlice, "pending" | "removedIds" | "truncated"> {
  const remoteIds = new Set(remote.map((i) => i.id));
  const localIds = new Set(local.map((i) => i.id));
  const wantedPending = local.filter((i) => !remoteIds.has(i.id)).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const wantedRemoved = remote.filter((i) => synced.has(i.id) && !localIds.has(i.id)).map((i) => i.id).sort();

  let room = budgetBytes - SLICE_OVERHEAD_BYTES;
  const take = <T>(items: readonly T[]): T[] => {
    const taken: T[] = [];
    for (const item of items) {
      const bytes = jsonBytes(item) + 1; // 区切りの `,` を含める
      if (bytes > room) break;
      room -= bytes;
      taken.push(item);
    }
    return taken;
  };
  const pending = take(wantedPending);
  const removedIds = take(wantedRemoved);
  return { pending, removedIds, truncated: wantedPending.length - pending.length + wantedRemoved.length - removedIds.length };
}

/** 管理端末に出す一覧。サーバーの一覧から、ホストが消した素材を除き、ホストにだけある素材を足す(同じ id は1件)。名前順。 */
export function mergeCatalog(remote: readonly CatalogItem[], slice: HostMediaSlice | null): CatalogItem[] {
  if (!slice) return [...remote];
  const removed = new Set(slice.removedIds);
  const kept = remote.filter((i) => !removed.has(i.id));
  const known = new Set(kept.map((i) => i.id));
  return [...kept, ...slice.pending.filter((i) => !known.has(i.id))].sort((a, b) => a.name.localeCompare(b.name));
}

const KINDS: readonly MediaKind[] = ["image", "video", "audio", "file"];
const isItem = (v: unknown): v is CatalogItem => {
  const i = v as Partial<CatalogItem> | null;
  return !!i && typeof i.id === "string" && typeof i.name === "string" && typeof i.folder === "string" && KINDS.includes(i.kind as MediaKind);
};

/** ルーム状態の `data` から、ホストが公開した `media` を読む。無い・形が違えば null(ホストが古い・まだ公開していない)。 */
export function readMediaSlice(data: Record<string, unknown> | null | undefined): HostMediaSlice | null {
  const v = data?.[MEDIA_NS] as Partial<HostMediaSlice> | undefined;
  if (!v || typeof v.rev !== "number" || !Array.isArray(v.pending) || !Array.isArray(v.removedIds) || typeof v.truncated !== "number") return null;
  const lastError = v.lastError && typeof v.lastError.assetId === "string" && typeof v.lastError.at === "number" ? { assetId: v.lastError.assetId, at: v.lastError.at } : undefined;
  return {
    rev: v.rev,
    pending: v.pending.filter(isItem),
    removedIds: v.removedIds.filter((id): id is string => typeof id === "string"),
    truncated: v.truncated,
    ...(lastError ? { lastError } : {}),
  };
}
