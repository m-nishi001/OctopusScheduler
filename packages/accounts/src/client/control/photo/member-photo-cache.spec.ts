import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { RateLimitedError } from "@octopus/infrastructures/interfaces";
import { MemberPhotoCache, PHOTOS_PER_READ } from "./member-photo-cache";
import type { MemberPhotoStore } from "./member-photo-cache";

const hash = (n: number) => n.toString(16).padStart(16, "0");
const url = (h: string) => `data:image/webp;base64,${h}`;

function source(missing: string[] = []) {
  const calls: string[][] = [];
  return {
    calls,
    fetchPhotos: vi.fn(async (hashes: string[]) => {
      calls.push(hashes);
      await new Promise((r) => setTimeout(r, 0));
      return Object.fromEntries(hashes.filter((h) => !missing.includes(h)).map((h) => [h, url(h)]));
    }),
  };
}

function memoryStore(initial: Record<string, string> = {}): MemberPhotoStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, get: async (h) => data.get(h), save: async (h, v) => void data.set(h, v) };
}

describe("MemberPhotoCache", () => {
  it("まとめて頼まれた写真を、最大10枚ずつの読み取りに分けて取る", async () => {
    const src = source();
    const cache = new MemberPhotoCache(src);
    const hashes = Array.from({ length: 25 }, (_, i) => hash(i));
    await cache.ensure(hashes);
    expect(src.calls.map((c) => c.length).sort((a, b) => b - a)).toEqual([PHOTOS_PER_READ, PHOTOS_PER_READ, 5]);
    expect(cache.get(hash(24))).toBe(url(hash(24)));
  });

  it("取得済みは取りに行かず、読み込み中のものには相乗りする(同じ写真は1回しか頼まない)", async () => {
    const src = source();
    const cache = new MemberPhotoCache(src);
    await Promise.all([cache.ensure([hash(1), hash(2)]), cache.ensure([hash(2), hash(3)]), cache.ensure([hash(1)])]);
    const requested = src.calls.flat();
    expect(requested.sort()).toEqual([hash(1), hash(2), hash(3)]);
    const before = src.fetchPhotos.mock.calls.length;
    await cache.ensure([hash(1), hash(2), hash(3)]);
    expect(src.fetchPhotos).toHaveBeenCalledTimes(before);
  });

  it("未指定・重複は無視する", async () => {
    const src = source();
    const cache = new MemberPhotoCache(src);
    await cache.ensure([undefined, hash(1), hash(1)]);
    expect(src.calls).toEqual([[hash(1)]]);
    expect(cache.get(undefined)).toBeUndefined();
  });

  it("端末に保存済みの写真は、サーバーへ取りに行かない。取った写真は端末に保存する", async () => {
    const src = source();
    const store = memoryStore({ [hash(1)]: url(hash(1)) });
    const cache = new MemberPhotoCache(src, { store });
    await cache.ensure([hash(1), hash(2)]);
    expect(src.calls).toEqual([[hash(2)]]);
    expect(cache.get(hash(1))).toBe(url(hash(1)));
    expect(store.data.get(hash(2))).toBe(url(hash(2)));
  });

  it("サーバーに無い写真は探し直さない。取得に失敗した写真は、次の機会に取り直す", async () => {
    const src = source([hash(9)]);
    const cache = new MemberPhotoCache(src);
    await cache.ensure([hash(9)]);
    await cache.ensure([hash(9)]);
    expect(src.fetchPhotos).toHaveBeenCalledTimes(1);
    expect(cache.get(hash(9))).toBeUndefined();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let fail = true;
    const flaky = new MemberPhotoCache({
      fetchPhotos: async (hs) => {
        if (fail) throw new Error("network");
        return Object.fromEntries(hs.map((h) => [h, url(h)]));
      },
    });
    await flaky.ensure([hash(1)]);
    expect(flaky.get(hash(1))).toBeUndefined();
    fail = false;
    await flaky.ensure([hash(1)]);
    expect(flaky.get(hash(1))).toBe(url(hash(1)));
    warn.mockRestore();
  });

  it("429 は待ってからやり直して取れる", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let first = true;
    const cache = new MemberPhotoCache({
      fetchPhotos: async (hs) => {
        if (first) {
          first = false;
          throw new RateLimitedError("Too many requests", 1);
        }
        return Object.fromEntries(hs.map((h) => [h, url(h)]));
      },
    });
    await cache.ensure([hash(1)]);
    expect(cache.get(hash(1))).toBe(url(hash(1)));
    warn.mockRestore();
  });

  it("remember した写真は、取りに行かずに使える", async () => {
    const src = source();
    const store = memoryStore();
    const cache = new MemberPhotoCache(src, { store });
    await cache.remember(hash(5), url(hash(5)));
    await cache.ensure([hash(5)]);
    expect(src.fetchPhotos).not.toHaveBeenCalled();
    expect(store.data.get(hash(5))).toBe(url(hash(5)));
  });
});
