/**
 * GAS シミュレーターの共有状態(Properties / Cache / Drive / Lock)。
 *
 * 本物の GAS ではこれらはスクリプトの外(Google 側)にあり、実行(execution)どうしで共有される。
 * ここではメインスレッドに 1 つだけ置き、各実行(worker_thread)は同期 RPC で読み書きする。
 * 外部に依存しない純粋な Node コードなので、単体テストできる。
 */
import { randomUUID } from "node:crypto";

/** ScriptProperties の上限(公称): 1 値 9KB、合計 500KB。キー + 値のバイト数で数える。 */
export const PROPERTY_VALUE_LIMIT_BYTES = 9 * 1024;
export const PROPERTIES_TOTAL_LIMIT_BYTES = 500 * 1024;
/** CacheService の上限(公称): 1 値 100KB、キー 250 文字、TTL 既定 600 秒・最大 21600 秒(6 時間)。 */
export const CACHE_VALUE_LIMIT_BYTES = 100 * 1024;
export const CACHE_KEY_LIMIT_CHARS = 250;
export const CACHE_DEFAULT_TTL_SEC = 600;
export const CACHE_MAX_TTL_SEC = 21600;

export const LOCK_TIMEOUT_MESSAGE = "Exception: Lock timeout: Another process was holding the lock for too long.";

const bytes = (s) => Buffer.byteLength(String(s), "utf8");

export class SimState {
  /** @param {{ now?: () => number }} [options] テストで時計を差し替える。 */
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    /** @type {Map<string, string>} */
    this.properties = new Map();
    /** @type {Map<string, { value: string, expiresAt: number }>} */
    this.cache = new Map();
    /** @type {Map<string, any>} id -> フォルダ/ファイルの実体 */
    this.items = new Map();
    this.rootFolderId = this.#newItem({ kind: "folder", name: "Root", parent: null }).id;
    /** 現在ロックを持っている実行の id。 */
    this.lockHolder = null;
    /** @type {Array<{ execId: string, resolve: () => void, reject: (e: Error) => void, timer: NodeJS.Timeout | null }>} */
    this.lockQueue = [];
    this.stats = { lockWaits: 0, lockTimeouts: 0 };
  }

  // ---------- Properties ----------
  propertiesBytes() {
    let total = 0;
    for (const [k, v] of this.properties) total += bytes(k) + bytes(v);
    return total;
  }

  getProperty(key) {
    return this.properties.has(key) ? this.properties.get(key) : null;
  }

  setProperty(key, value) {
    const v = String(value);
    if (bytes(v) > PROPERTY_VALUE_LIMIT_BYTES) {
      throw new Error(`Exception: Property value exceeds the maximum size limit (${PROPERTY_VALUE_LIMIT_BYTES} bytes): ${key}`);
    }
    const before = this.properties.has(key) ? bytes(key) + bytes(this.properties.get(key)) : 0;
    if (this.propertiesBytes() - before + bytes(key) + bytes(v) > PROPERTIES_TOTAL_LIMIT_BYTES) {
      throw new Error(`Exception: Properties storage quota exceeded (total limit ${PROPERTIES_TOTAL_LIMIT_BYTES} bytes)`);
    }
    this.properties.set(key, v);
  }

  deleteProperty(key) {
    this.properties.delete(key);
  }

  propertyKeys() {
    return [...this.properties.keys()];
  }

  // ---------- Cache ----------
  #sweep() {
    const t = this.now();
    for (const [k, e] of this.cache) if (e.expiresAt <= t) this.cache.delete(k);
  }

  cacheGet(key) {
    this.#sweep();
    return this.cache.has(key) ? this.cache.get(key).value : null;
  }

  cachePut(key, value, ttlSec) {
    if (String(key).length > CACHE_KEY_LIMIT_CHARS) throw new Error("Exception: Argument too large: key");
    const v = String(value);
    if (bytes(v) > CACHE_VALUE_LIMIT_BYTES) throw new Error("Exception: Argument too large: value");
    const ttl = Math.min(Math.max(Number(ttlSec ?? CACHE_DEFAULT_TTL_SEC) || CACHE_DEFAULT_TTL_SEC, 1), CACHE_MAX_TTL_SEC);
    this.cache.set(key, { value: v, expiresAt: this.now() + ttl * 1000 });
  }

  cacheRemove(key) {
    this.cache.delete(key);
  }

  // ---------- Drive ----------
  #newItem(fields) {
    const t = this.now();
    const item = { id: `sim${randomUUID().replace(/-/g, "")}`, created: t, updated: t, trashed: false, ...fields };
    this.items.set(item.id, item);
    return item;
  }

  #get(id, kind) {
    const item = this.items.get(id);
    if (!item || (kind && item.kind !== kind)) {
      throw new Error(`Exception: No item with the given ID could be found, or you do not have permission to access it. (${id})`);
    }
    return item;
  }

  #meta(item) {
    return {
      id: item.id,
      name: item.name,
      kind: item.kind,
      created: item.created,
      updated: item.updated,
      mimeType: item.mimeType ?? null,
      size: item.content ? item.content.length : 0,
      trashed: item.trashed,
    };
  }

  /** フォルダの有無を確かめる(DriveApp.getFolderById)。 */
  getFolder(id) {
    return this.#meta(this.#get(id, "folder"));
  }

  getFile(id) {
    return this.#meta(this.#get(id, "file"));
  }

  /** 直下の子(ゴミ箱を除く)。name を渡すと完全一致のものだけ。作成順。 */
  listChildren(parentId, kind, name) {
    this.#get(parentId, "folder");
    const out = [];
    for (const item of this.items.values()) {
      if (item.parent !== parentId || item.kind !== kind || item.trashed) continue;
      if (name !== undefined && name !== null && item.name !== name) continue;
      out.push(this.#meta(item));
    }
    return out;
  }

  /** 同名のフォルダがあっても作る(Drive は重複を許す)。排他は呼び出し側が LockService で行う。 */
  createFolder(parentId, name) {
    this.#get(parentId, "folder");
    return this.#meta(this.#newItem({ kind: "folder", name: String(name), parent: parentId }));
  }

  createFile(parentId, name, mimeType, content) {
    this.#get(parentId, "folder");
    return this.#meta(this.#newItem({ kind: "file", name: String(name), parent: parentId, mimeType, content: Buffer.from(content) }));
  }

  fileContent(id) {
    return this.#get(id, "file").content;
  }

  setFileContent(id, content) {
    const item = this.#get(id, "file");
    item.content = Buffer.from(content);
    item.updated = this.now();
    return this.#meta(item);
  }

  setName(id, name) {
    const item = this.#get(id);
    item.name = String(name);
    item.updated = this.now();
  }

  setTrashed(id, trashed) {
    const item = this.#get(id);
    item.trashed = Boolean(trashed);
    item.updated = this.now();
  }

  // ---------- Lock(スクリプトロック: スクリプトに 1 つだけ) ----------
  /**
   * ロックを取る。すでに同じ実行が持っていれば何もしない(本物の `waitLock` も「すでに取得済みなら効果なし」)。
   * 他の実行が持っていれば timeoutMs まで待ち、取れなければ例外。先着順。
   * @returns {Promise<void>}
   */
  lockWait(execId, timeoutMs) {
    if (this.lockHolder === null || this.lockHolder === execId) {
      this.lockHolder = execId;
      return Promise.resolve();
    }
    this.stats.lockWaits++;
    return new Promise((resolve, reject) => {
      const entry = { execId, resolve, reject, timer: null };
      entry.timer = setTimeout(() => {
        this.lockQueue = this.lockQueue.filter((e) => e !== entry);
        this.stats.lockTimeouts++;
        reject(new Error(LOCK_TIMEOUT_MESSAGE));
      }, Math.max(0, Number(timeoutMs) || 0));
      this.lockQueue.push(entry);
    });
  }

  lockTry(execId) {
    if (this.lockHolder === null || this.lockHolder === execId) {
      this.lockHolder = execId;
      return true;
    }
    return false;
  }

  lockHas(execId) {
    return this.lockHolder === execId;
  }

  /** 持っていなければ何もしない。解放したら待ち行列の先頭に渡す。 */
  lockRelease(execId) {
    if (this.lockHolder !== execId) return;
    this.lockHolder = null;
    const next = this.lockQueue.shift();
    if (next) {
      clearTimeout(next.timer);
      this.lockHolder = next.execId;
      next.resolve();
    }
  }

  /** 実行が終わった(または打ち切られた)ときに、持っていたロックを解放し、待ち行列からも外す。 */
  endExecution(execId) {
    this.lockQueue = this.lockQueue.filter((e) => {
      if (e.execId !== execId) return true;
      clearTimeout(e.timer);
      return false;
    });
    this.lockRelease(execId);
  }
}
