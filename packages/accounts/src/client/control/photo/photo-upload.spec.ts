import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { uploadMemberPhotos } from "./photo-upload";
import type { PreparedPhoto } from "./photo-prepare";

const photo = (n: number): PreparedPhoto => ({ hash: n.toString(16).padStart(16, "0"), mime: "image/webp", dataUrl: `data:image/webp;base64,${n}` });

describe("uploadMemberPhotos", () => {
  it("サーバーにある写真は送らず、無いものだけを送る(確認は1回)", async () => {
    const put = vi.fn(async (_hash: string, _dataUrl: string) => undefined);
    const exists = vi.fn(async (hashes: string[]) => hashes.filter((h) => h === photo(2).hash));
    const result = await uploadMemberPhotos({ existsMemberPhotos: exists, putMemberPhoto: put }, [photo(1), photo(2), photo(3)]);
    expect(result).toEqual({ uploaded: 2, skipped: 1 });
    expect(exists).toHaveBeenCalledTimes(1);
    expect(put.mock.calls.map((c) => c[0]).sort()).toEqual([photo(1).hash, photo(3).hash]);
  });

  it("同じ写真が複数あっても1回だけ送る。何も無ければ何も呼ばない", async () => {
    const put = vi.fn(async () => undefined);
    const exists = vi.fn(async () => []);
    await uploadMemberPhotos({ existsMemberPhotos: exists, putMemberPhoto: put }, [photo(1), photo(1)]);
    expect(put).toHaveBeenCalledTimes(1);
    exists.mockClear();
    expect(await uploadMemberPhotos({ existsMemberPhotos: exists, putMemberPhoto: put }, [])).toEqual({ uploaded: 0, skipped: 0 });
    expect(exists).not.toHaveBeenCalled();
  });

  it("並列に送る(同時実行数の上限まで)", async () => {
    let running = 0;
    let max = 0;
    const put = async () => {
      running++;
      max = Math.max(max, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    };
    await uploadMemberPhotos(
      { existsMemberPhotos: async () => [], putMemberPhoto: put },
      Array.from({ length: 20 }, (_, i) => photo(i)),
      { concurrency: 4 }
    );
    expect(max).toBe(4);
  });

  it("1枚でも失敗したら例外を投げる", async () => {
    const put = vi.fn(async (hash: string) => {
      if (hash === photo(2).hash) throw new Error("boom");
    });
    await expect(
      uploadMemberPhotos({ existsMemberPhotos: async () => [], putMemberPhoto: put }, [photo(1), photo(2)])
    ).rejects.toThrow("boom");
  });
});
