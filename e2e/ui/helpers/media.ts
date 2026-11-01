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
export async function seedServerAsset(request: APIRequestContext, asset: { id: string; fileName: string; mime: string; body: Buffer }): Promise<void> {
  const hash = createHash("sha256").update(asset.body).digest("hex").slice(0, 32);
  await adminRpc(request, "octopusScheduler_putAssetBlob", { hash, dataUrl: `data:${asset.mime};base64,${asset.body.toString("base64")}` });
  const { json } = await adminRpc<{ json: string | null }>(request, "octopusScheduler_getAssetRecord", {});
  const data: Record<string, unknown>[] = json ? JSON.parse(json).data : [];
  const now = new Date().toISOString();
  data.push({ id: asset.id, name: asset.fileName, mime: asset.mime, hash, size: asset.body.length, uploadedAt: now, lastUpdated: now });
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

const ASSET_DB = "octopus-scheduler";
const ASSET_STORE = "Asset";

/** この端末(IndexedDB)の素材を直接入れる。`directoryId` を付けると、フォルダの素材になる。 */
export async function seedLocalAsset(page: Page, asset: { id: string; name: string; mime: string; body: Buffer; directoryId?: string }): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, id, name, mime, base64, directoryId }) => {
      const blob = await (await fetch(`data:${mime};base64,${base64}`)).blob();
      const open = (version?: number) =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const req = version === undefined ? indexedDB.open(dbName) : indexedDB.open(dbName, version);
          req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      let db = await open();
      if (!db.objectStoreNames.contains(storeName)) {
        const next = db.version + 1;
        db.close();
        db = await open(next);
      }
      const now = new Date().toISOString();
      const value = { id, blob, name, uploadedAt: now, lastUpdated: now, size: blob.size, ...(directoryId ? { directoryId } : {}) };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put({ data: value, updatedAt: Date.now() }, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { dbName: ASSET_DB, storeName: ASSET_STORE, id: asset.id, name: asset.name, mime: asset.mime, base64: asset.body.toString("base64"), directoryId: asset.directoryId }
  );
}

/** この端末の素材が、あるか。 */
export function hasLocalAsset(page: Page, id: string): Promise<boolean> {
  return page.evaluate(
    async ({ dbName, storeName, id }) => {
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
        const req = db.transaction(storeName, "readonly").objectStore(storeName).get(id);
        req.onsuccess = () => resolve(req.result !== undefined);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return found;
    },
    { dbName: ASSET_DB, storeName: ASSET_STORE, id }
  );
}

/** この端末の素材を消す(ホストがまだ取っていない状態を作る)。 */
export function deleteLocalAsset(page: Page, id: string): Promise<void> {
  return page.evaluate(
    async ({ dbName, storeName, id }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (db.objectStoreNames.contains(storeName)) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
      db.close();
    },
    { dbName: ASSET_DB, storeName: ASSET_STORE, id }
  );
}
