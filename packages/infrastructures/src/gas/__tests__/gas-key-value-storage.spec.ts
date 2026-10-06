import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GasKeyValueStorage,
  ROOT_FOLDER_PROPERTY_KEY,
} from "../gas-key-value-storage";
import { StorageNotConfiguredError } from "../../interfaces/key-value-storage";

// --- 最小限の Drive / Properties フェイク ---
class FakeFile {
  trashed = false;
  constructor(
    private name: string,
    private content: string,
    private mime: string
  ) {}
  getName() { return this.name; }
  setName(n: string) { this.name = n; }
  setTrashed(v: boolean) { this.trashed = v; }
  getMimeType() { return this.mime; }
  getSize() { return this.content.length; }
  getDateCreated() { return new Date(0); }
  getLastUpdated() { return new Date(0); }
  getBlob() {
    const c = this.content;
    return {
      getDataAsString: () => c,
      getBytes: () => Array.from(Buffer.from(c)),
    };
  }
}

const iter = <T>(items: T[]) => {
  let i = 0;
  return { hasNext: () => i < items.length, next: () => items[i++] };
};

class FakeFolder {
  created = new Date(0);
  folders = new Map<string, FakeFolder>();
  /** 同名の重複フォルダ(過去の競合で生じたもの)。 */
  duplicates = new Map<string, FakeFolder[]>();
  /** createFolder の直前に走らせるフック(ロック待ち中の競合を模擬)。 */
  beforeCreate: (() => void) | null = null;
  getDateCreated() { return this.created; }
  files: FakeFile[] = [];
  getFoldersByName(n: string) {
    const all = [...(this.folders.has(n) ? [this.folders.get(n)!] : []), ...(this.duplicates.get(n) ?? [])];
    return iter(all);
  }
  createFolder(n: string) {
    createFolderCalls++;
    const f = new FakeFolder();
    this.folders.set(n, f);
    return f;
  }
  getFilesByName(n: string) { return iter(this.files.filter((f) => !f.trashed && f.getName() === n)); }
  getFiles() { return iter(this.files.filter((f) => !f.trashed)); }
  createFile(blob: { name: string; content: string; mime: string }) {
    const f = new FakeFile(blob.name, blob.content, blob.mime);
    this.files.push(f);
    return f;
  }
}

const g = globalThis as Record<string, unknown>;
let props: Record<string, string>;
let root: FakeFolder;
let createFolderCalls: number;
let lockEvents: string[];
let lockFails: boolean;

beforeEach(() => {
  props = {};
  root = new FakeFolder();
  createFolderCalls = 0;
  lockEvents = [];
  lockFails = false;
  g.LockService = {
    getScriptLock: () => ({
      waitLock: () => {
        if (lockFails) throw new Error("timeout");
        lockEvents.push("lock");
      },
      releaseLock: () => { lockEvents.push("release"); },
    }),
  };
  g.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k: string) => props[k] ?? null,
      setProperty: (k: string, v: string) => { props[k] = v; },
    }),
  };
  g.DriveApp = {
    getFolderById: (id: string) => {
      if (id !== "root-id") throw new Error("not found");
      return root;
    },
  };
  g.Utilities = {
    newBlob: (content: string, mime: string, name: string) => ({ content, mime, name }),
  };
});

afterEach(() => {
  delete g.PropertiesService;
  delete g.DriveApp;
  delete g.Utilities;
  delete g.LockService;
});

describe("GasKeyValueStorage (root-relative paths)", () => {
  it("throws StorageNotConfiguredError when the root property is missing", async () => {
    const kv = new GasKeyValueStorage();
    await expect(kv.putText("a/b/c.json", "{}", "application/json")).rejects.toThrow(
      StorageNotConfiguredError
    );
    await expect(kv.stat("a/b/c.json")).rejects.toThrow(StorageNotConfiguredError);
    await expect(kv.listByPrefix("a/b/")).rejects.toThrow(StorageNotConfiguredError);
  });

  it("throws StorageNotConfiguredError when the root id is not accessible", async () => {
    props[ROOT_FOLDER_PROPERTY_KEY] = "wrong";
    await expect(new GasKeyValueStorage().stat("a/b/c.json")).rejects.toThrow(
      StorageNotConfiguredError
    );
  });

  it("creates sub-folders under the root and reads the file back", async () => {
    props[ROOT_FOLDER_PROPERTY_KEY] = "root-id";
    const kv = new GasKeyValueStorage();

    const meta = await kv.putText("octopus-scheduler/assets/1_a.txt", "hello", "text/plain");
    expect(meta.key).toBe("octopus-scheduler/assets/1_a.txt");
    expect(root.folders.get("octopus-scheduler")!.folders.has("assets")).toBe(true);
    expect(await kv.getContentAsText("octopus-scheduler/assets/1_a.txt")).toBe("hello");
    expect(await kv.stat("octopus-scheduler/assets/missing")).toBeNull();
    expect(await kv.stat("other/assets/1_a.txt")).toBeNull();
  });

  it("lists only files directly under the directory that match the prefix", async () => {
    props[ROOT_FOLDER_PROPERTY_KEY] = "root-id";
    const kv = new GasKeyValueStorage();
    await kv.putText("quiz-game/json/1_a.json", "[]", "application/json");
    await kv.putText("quiz-game/json/2_b.json", "[]", "application/json");
    await kv.putText("quiz-game/assets/1_x.png", "x", "image/png");

    const all = await kv.listByPrefix("quiz-game/json/");
    expect(all.map((m) => m.key).sort()).toEqual([
      "quiz-game/json/1_a.json",
      "quiz-game/json/2_b.json",
    ]);
    const one = await kv.listByPrefix("quiz-game/json/1_");
    expect(one.map((m) => m.key)).toEqual(["quiz-game/json/1_a.json"]);
    expect(await kv.listByPrefix("nope/json/")).toEqual([]);
  });

  it("overwrites an existing file and deletes it", async () => {
    props[ROOT_FOLDER_PROPERTY_KEY] = "root-id";
    const kv = new GasKeyValueStorage();
    await kv.putText("m/json/a.json", "1", "application/json");
    await kv.putText("m/json/a.json", "2", "application/json");
    expect(await kv.getContentAsText("m/json/a.json")).toBe("2");

    expect((await kv.delete("m/json/a.json"))?.key).toBe("m/json/a.json");
    expect(await kv.stat("m/json/a.json")).toBeNull();
  });

  it("takes the script lock only when a folder must be created", async () => {
    props[ROOT_FOLDER_PROPERTY_KEY] = "root-id";
    const kv = new GasKeyValueStorage();
    await kv.putText("quiz-game/assets/1_a.png", "a", "image/png");
    expect(lockEvents).toEqual(["lock", "release", "lock", "release"]); // quiz-game, assets
    lockEvents.length = 0;
    await kv.putText("quiz-game/assets/2_b.png", "b", "image/png");
    expect(lockEvents).toEqual([]);
  });

  it("re-checks inside the lock and does not create a duplicate folder", async () => {
    props[ROOT_FOLDER_PROPERTY_KEY] = "root-id";
    // ロック待ちの間に別実行が quiz-game を作った状況を模擬する。
    const concurrent = new FakeFolder();
    g.LockService = {
      getScriptLock: () => ({
        waitLock: () => { root.folders.set("quiz-game", concurrent); },
        releaseLock: () => {},
      }),
    };
    await new GasKeyValueStorage().putText("quiz-game/json/a.json", "{}", "application/json");
    expect(root.folders.get("quiz-game")).toBe(concurrent);
    expect(concurrent.folders.has("json")).toBe(true);
    // quiz-game は再確認で見つかったので作成していない(json のみ作成)。
    expect(createFolderCalls).toBe(1);
  });

  it("throws a busy error when the lock cannot be acquired", async () => {
    props[ROOT_FOLDER_PROPERTY_KEY] = "root-id";
    lockFails = true;
    await expect(
      new GasKeyValueStorage().putText("quiz-game/json/a.json", "{}", "application/json")
    ).rejects.toThrow("Server is busy");
    expect(createFolderCalls).toBe(0);
  });

  it("uses the oldest folder when duplicates with the same name exist", async () => {
    props[ROOT_FOLDER_PROPERTY_KEY] = "root-id";
    const oldest = new FakeFolder();
    oldest.created = new Date(1000);
    const newer = new FakeFolder();
    newer.created = new Date(2000);
    root.folders.set("quiz-game", newer);
    root.duplicates.set("quiz-game", [oldest]);
    const kv = new GasKeyValueStorage();

    await kv.putText("quiz-game/json/a.json", "{}", "application/json");
    expect(oldest.folders.has("json")).toBe(true);
    expect(newer.folders.has("json")).toBe(false);
    expect(await kv.getContentAsText("quiz-game/json/a.json")).toBe("{}");
    expect(createFolderCalls).toBe(1);
  });
});
