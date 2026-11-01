import { createHash } from "node:crypto";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { adminRpc } from "../fixtures";

/** 1x1 の PNG(自作の最小の画像)。 */
export const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

/** 無音の WAV(8kHz・モノラル・16bit・20秒)。コードで作る最小の音声。 */
export function silentWav(): Buffer {
  const samples = 8000 * 20;
  const data = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // モノラル
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(16000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export const uid = () => Math.random().toString(36).slice(2, 8);

/** サーバーの素材置き場に素材を 1 件入れる(管理者として)。中身をハッシュのファイルに置き、素材の一覧に 1 件足す。id は英数字だけ(`_` は素材 ID の区切りに使われる)。 */
export async function seedServerAsset(request: APIRequestContext, asset: { id: string; fileName: string; mime: string; body: Buffer; directoryId?: string }): Promise<void> {
  const hash = blobHash(asset.body);
  await adminRpc(request, "octopusScheduler_putAssetBlob", { hash, dataUrl: `data:${asset.mime};base64,${asset.body.toString("base64")}` });
  const { json } = await adminRpc<{ json: string | null }>(request, "octopusScheduler_getAssetRecord", {});
  const data: Record<string, unknown>[] = json ? JSON.parse(json).data : [];
  const now = new Date().toISOString();
  data.push({ id: asset.id, name: asset.fileName, mime: asset.mime, hash, size: asset.body.length, uploadedAt: now, lastUpdated: now, ...(asset.directoryId ? { directoryId: asset.directoryId } : {}) });
  await adminRpc(request, "octopusScheduler_saveAssetRecord", { json: JSON.stringify({ updatedAt: now, data }) });
}

/** 音を鳴らす部品の呼び出しを数える(ヘッドレスでは音が聞こえないので、再生の開始と停止の呼び出しで確かめる)。ページを開く前に入れる。 */
export async function installAudioProbe(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const probe = { started: 0, stopped: 0 };
    (window as unknown as { __audioProbe: typeof probe }).__audioProbe = probe;
    const proto = (window as unknown as { AudioBufferSourceNode?: { prototype: { start: (...a: unknown[]) => void; stop: (...a: unknown[]) => void } } }).AudioBufferSourceNode?.prototype;
    if (!proto) return;
    const start = proto.start;
    const stop = proto.stop;
    proto.start = function (this: unknown, ...args: unknown[]) {
      probe.started++;
      return start.apply(this, args);
    };
    proto.stop = function (this: unknown, ...args: unknown[]) {
      probe.stopped++;
      return stop.apply(this, args);
    };
  });
}

export const audioProbe = (page: Page) => page.evaluate(() => (window as unknown as { __audioProbe: { started: number; stopped: number } }).__audioProbe);

const BLOB_DB = "octopus-scheduler-asset-blobs";
const BLOB_STORE = "Blobs";

/** 中身のハッシュ(アプリの `hashBlob` と同じ: SHA-256 の先頭32桁・16進)。 */
export const blobHash = (body: Buffer) => createHash("sha256").update(body).digest("hex").slice(0, 32);

/** この端末(IndexedDB)に、その中身のファイル(ハッシュで引く)が、あるか。 */
export function hasLocalBlob(page: Page, body: Buffer): Promise<boolean> {
  return page.evaluate(
    async ({ dbName, storeName, hash }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        return false;
      }
      const found = await new Promise<boolean>((resolve, reject) => {
        const req = db.transaction(storeName, "readonly").objectStore(storeName).get(hash);
        req.onsuccess = () => resolve(req.result !== undefined);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return found;
    },
    { dbName: BLOB_DB, storeName: BLOB_STORE, hash: blobHash(body) }
  );
}

/** この端末のその中身のファイルを消す(ホストがまだ取っていない状態を作る)。素材の一覧は触らない。 */
export function deleteLocalBlob(page: Page, body: Buffer): Promise<void> {
  return page.evaluate(
    async ({ dbName, storeName, hash }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (db.objectStoreNames.contains(storeName)) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).delete(hash);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
      db.close();
    },
    { dbName: BLOB_DB, storeName: BLOB_STORE, hash: blobHash(body) }
  );
}
