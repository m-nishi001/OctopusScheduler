import localforage from "localforage";

/**
 * データの永続化に使用されるDTO（Data Transfer Object）。
 * 永続化のためのメタデータ（最終更新日時など）を含みます。
 */
export interface StoredData<T> {
  data: T;
  updatedAt: number;
}

/**
 * 汎用的なローカルストレージサービス。
 * 各リポジトリから利用されることを想定しています。
 */
export class LocalStorageService {
  private lfInstance: LocalForage;

  /**
   * コンストラクタでLocalForageのインスタンスをDI可能にします。
   *
   * @param dbName データベース名。アプリケーション全体で一意であるべきです。
   * @param storeName ストア名。ドメイン（エンティティ）ごとに設定されることを想定しています。
   */
  constructor(dbName: string, storeName: string) {
    this.lfInstance = localforage.createInstance({
      name: dbName,
      storeName: storeName,
    });
  }

  /**
   * データを指定されたIDで保存します。
   *
   * @param id データの識別子 (キー)。
   * @param data 保存するデータ。
   */
  async save<T>(id: string, data: T): Promise<void> {
    const storedData: StoredData<T> = {
      data: data,
      updatedAt: Date.now(),
    };
    // Validate data cloneability in the browser's structured clone algorithm.
    // This helps detect non-serializable objects (functions, DOM nodes, circular refs)
    // which otherwise raise a cryptic DataCloneError in IndexedDB.
    try {
      // Prefer the native structuredClone if available
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - structuredClone is a global in modern browsers / Node 17+
      if (typeof (globalThis as any).structuredClone === "function") {
        // Try to clone to validate.
        // Some environments may not have structuredClone available; we'll fallback.
        (globalThis as any).structuredClone(storedData);
      } else {
        // Fallback: try JSON.stringify - this won't detect all issues but will catch circular refs.
        JSON.stringify(storedData);
      }
    } catch (err) {
      // build a helpful debug message
      console.error(
        `[LocalStorageService.save] Data for id=${id} is not cloneable. This will cause IDB put to fail.`,
        { id, sampleData: storedData }
      );
      // add some heuristics: try find offending property types
      try {
        const nonSerializable: string[] = [];
        const visited = new Set<any>();
        const find = (obj: any, path = "root") => {
          if (obj === null || obj === undefined) return;
          if (visited.has(obj)) return;
          visited.add(obj);
          const t = typeof obj;
          if (t === "function") {
            nonSerializable.push(path + " (function)");
            return;
          }
          if (t === "symbol") {
            nonSerializable.push(path + " (symbol)");
            return;
          }
          if (obj instanceof Node) {
            nonSerializable.push(path + " (DOM Node)");
            return;
          }
          if (Array.isArray(obj)) {
            obj.forEach((v, i) => find(v, `${path}[${i}]`));
            return;
          }
          if (t === "object") {
            for (const k of Object.keys(obj)) {
              find(obj[k], `${path}.${k}`);
            }
          }
        };
        find(storedData.data, "data");
        if (nonSerializable.length) {
          console.error(
            "Likely non-serializable properties:",
            nonSerializable.slice(0, 10)
          );
        }
      } catch (e) {
        // ignore diagnostics errors
      }
      throw err;
    }

    await this.lfInstance.setItem(id, storedData);
  }

  /**
   * 指定されたIDのデータを取得します。
   *
   * @param id データの識別子 (キー)。
   * @returns 取得したデータ。見つからない場合はundefined。
   */
  async get<T>(id: string): Promise<T | undefined> {
    const storedData: StoredData<T> | null = await this.lfInstance.getItem(id);
    return storedData?.data;
  }

  /**
   * 指定されたIDのデータを削除します。
   *
   * @param id データの識別子 (キー)。
   */
  async delete(id: string): Promise<void> {
    await this.lfInstance.removeItem(id);
  }

  /**
   * ストレージに保存されているすべてのデータを取得します。
   *
   * @returns すべてのデータをIDをキーとするMapで返します。
   */
  async getAll<T>(): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    await this.lfInstance.iterate((value: StoredData<T>, key: string) => {
      try {
        results.set(key, value.data);
      } catch (err) {
        console.error(`[getAll] Error setting key:`, key, err);
      }
    });
    return results;
  }

  /**
   * ストレージ内のすべてのデータをクリアします。
   */
  async clear(): Promise<void> {
    await this.lfInstance.clear();
  }

  /**
   * 複数のデータを指定されたIDで保存します。
   * @param items 保存するデータを含むMap (キー: ID, 値: データ)
   * @returns 保存が完了したPromise
   */
  async saveMultiple<T>(items: Map<string, T>): Promise<void> {
    const promises: Promise<any>[] = [];
    items.forEach((value, id) => {
      const storedData: StoredData<T> = {
        data: value,
        updatedAt: Date.now(),
      };
      // validate like save()
      try {
        if (typeof (globalThis as any).structuredClone === "function") {
          (globalThis as any).structuredClone(storedData);
        } else {
          JSON.stringify(storedData);
        }
      } catch (err) {
        console.error(
          `[LocalStorageService.saveMultiple] Data for id=${id} is not cloneable.`,
          {
            id,
            sampleData: storedData,
          }
        );
        throw err;
      }
      promises.push(this.lfInstance.setItem(id, storedData));
    });
    await Promise.all(promises);
  }

  /**
   * 複数のIDに対応するデータをストレージから一括で取得します。
   * @param ids 取得するデータの識別子 (キー) の配列
   * @returns 取得したデータを含むMap (キー: ID, 値: データまたはundefined)
   */
  async getMultiple<T>(ids: string[]): Promise<Map<string, T | undefined>> {
    const results = new Map<string, T | undefined>();
    const promises = ids.map(async (id) => {
      const storedData: StoredData<T> | null =
        await this.lfInstance.getItem(id);
      results.set(id, storedData?.data);
    });
    await Promise.all(promises);
    return results;
  }

  /**
   * 複数のIDに対応するデータをストレージから一括で削除します。
   * @param ids 削除するデータの識別子 (キー) の配列
   * @returns 削除が完了したPromise
   */
  async removeMultiple(ids: string[]): Promise<void> {
    const promises = ids.map((id) => this.lfInstance.removeItem(id));
    await Promise.all(promises);
  }
}
