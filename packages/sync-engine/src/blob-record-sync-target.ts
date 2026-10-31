import type { SyncSnapshot, SyncTarget } from "./sync-target";
import type { BlobRecordLocalStore } from "./blob-record-store";

/** サーバー側の保存先。同じ `{ updatedAt, data }` をそのまま保存し、そのまま返す。 */
export interface BlobRecordRemote<T> {
  /** 保存されているレコード。まだ無ければ null。通信の失敗は例外で伝える(空と取り違えないため)。 */
  get(): Promise<SyncSnapshot<T> | null>;
  put(snapshot: SyncSnapshot<T>): Promise<void>;
}

/**
 * 「種類(kind)ごとに1件のレコード `{ data, updatedAt }`」を、ローカルとサーバーの両方に持つ同期対象。
 * - push: 判定のときに読んだレコードをそのままサーバーへ保存して終わり(端末へ書き戻さない)。
 *   送信中に編集されても、ローカルのほうが新しいままなので、次の同期でまた送られる。
 * - pull: ローカルの更新日時が判定のときから変わっていなければ、サーバーのレコードをそのまま1回書く。
 *   書く直前にもう一度読んで確かめ、変わっていたら書かない(その編集は次の同期で送られる)。
 */
export function blobRecordSyncTarget<T>(
  kind: string,
  local: BlobRecordLocalStore<T>,
  remote: BlobRecordRemote<T>
): SyncTarget<T, T> {
  return {
    id: kind,
    kind,
    getLocal: () => local.read(),
    getRemote: () => remote.get(),
    push: (snapshot) => remote.put(snapshot),
    pull: (remoteSnapshot, localSnapshot) =>
      local.replaceIfUnchanged(localSnapshot?.updatedAt ?? null, remoteSnapshot),
  };
}

/** サーバーに保存する形。更新日時とデータを、そのままJSONのテキストにする。 */
export function stringifyBlobRecord<T>(snapshot: SyncSnapshot<T>): string {
  return JSON.stringify({ updatedAt: snapshot.updatedAt, data: snapshot.data });
}

/**
 * サーバーのテキストを `{ data, updatedAt }` に読む。テキストが無い・JSONとして読めない・形が違う(古い形式など)ときは
 * 「リモートにレコードは無い」(null)として扱う。
 */
export function parseBlobRecord<T>(text: string | null): SyncSnapshot<T> | null {
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { updatedAt, data } = value as { updatedAt?: unknown; data?: unknown };
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || data === undefined) return null;
  return { data: data as T, updatedAt };
}

/** テキストを読み書きするだけの保存先(各アプリのAPI)から、`BlobRecordRemote` を作る。 */
export function textBlobRecordRemote<T>(io: {
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}): BlobRecordRemote<T> {
  return {
    get: async () => parseBlobRecord<T>(await io.read()),
    put: (snapshot) => io.write(stringifyBlobRecord(snapshot)),
  };
}
