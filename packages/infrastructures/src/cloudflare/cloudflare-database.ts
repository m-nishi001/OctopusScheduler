import type { DataBaseFactory, DataCollection, IDataBase } from "../interfaces/database";
import { currentEnv } from "./request-context";

const RESERVED_TABLE_NAMES = new Set(["cache_entries", "locks"]);
const VALID_TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * IDataBase の Cloudflare 実装(D1)。
 *
 * D1バインディングはWorkerごとに固定のため、GASの `dataBaseId`
 * (スプレッドシートID)に相当する動的な切り替え先はない。ファクトリの引数は
 * インターフェース互換のために受け取るが無視する。
 */
class CloudflareDataBase implements IDataBase {
  async listCollections(): Promise<string[]> {
    const { results } = await currentEnv()
      .DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all<{ name: string }>();
    return results.map((r) => r.name).filter((name) => !RESERVED_TABLE_NAMES.has(name));
  }

  async getCollection(name: string): Promise<DataCollection | null> {
    if (!VALID_TABLE_NAME.test(name) || RESERVED_TABLE_NAMES.has(name)) return null;
    try {
      const { results } = await currentEnv().DB.prepare(`SELECT * FROM "${name}"`).all();
      const rows = results.map((row) => Object.values(row));
      return { name, rows };
    } catch {
      return null;
    }
  }
}

export const createCloudflareDataBase: DataBaseFactory = () => new CloudflareDataBase();
