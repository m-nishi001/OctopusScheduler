import { describe, expect, it, vi } from "vitest";
import type { AssetRecordEntry } from "../../../server/scheduler-api-contract";
import { folderImageLister, runSlideshow, type SlideshowDeps } from "./slideshow";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const spec = { kind: "slideshow", folder: "f", intervalSec: 2, transition: "fade" } as const;
const names = new WeakMap<Blob, string>();
const img = (name: string) => {
  const b = new Blob([name], { type: "image/png" });
  names.set(b, name);
  return b;
};

/** 時間を手で進める sleep。呼ばれるたびに待ちが1つ増え、`tick()` で1つ進む。 */
function manualClock() {
  const waits: Array<() => void> = [];
  return {
    sleep: vi.fn((_ms: number) => new Promise<void>((resolve) => waits.push(resolve))),
    async tick() {
      await vi.waitFor(() => expect(waits.length).toBeGreaterThan(0));
      waits.shift()!();
    },
  };
}

describe("runSlideshow", () => {
  it("フォルダの画像を全部先に取りはじめ、順に表示して、最後まで行ったら先頭に戻る", async () => {
    const clock = manualClock();
    const ensure = vi.fn(async (id: string) => img(id));
    const shown: Array<[string, number]> = [];
    const deps: SlideshowDeps = { listImageIds: async () => ["a", "b", "c"], ensure, sleep: clock.sleep };
    const stop = runSlideshow(spec, deps, (blob, i) => shown.push([names.get(blob) ?? "", i]));
    await vi.waitFor(() => expect(ensure).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(shown).toHaveLength(1));
    for (let n = 0; n < 3; n++) await clock.tick();
    await vi.waitFor(() => expect(shown).toHaveLength(4));
    expect(shown.map(([, i]) => i)).toEqual([0, 1, 2, 0]);
    expect(clock.sleep).toHaveBeenCalledWith(2000);
    stop();
  });

  it("画像の取得が遅くても、抜かさない。前の画像が長めに映るだけ", async () => {
    const clock = manualClock();
    const slow = deferred<Blob>();
    const ensure = vi.fn((id: string) => (id === "b" ? slow.promise : Promise.resolve(img(id))));
    const shownIndexes: number[] = [];
    const stop = runSlideshow(spec, { listImageIds: async () => ["a", "b", "c"], ensure, sleep: clock.sleep }, (_b, i) => shownIndexes.push(i));
    await vi.waitFor(() => expect(shownIndexes).toEqual([0]));
    await clock.tick();
    // b がまだ届いていない間は、a のまま。c へ飛ばない
    await new Promise((r) => setTimeout(r, 20));
    expect(shownIndexes).toEqual([0]);
    slow.resolve(img("b"));
    await vi.waitFor(() => expect(shownIndexes).toEqual([0, 1]));
    await clock.tick();
    await vi.waitFor(() => expect(shownIndexes).toEqual([0, 1, 2]));
    stop();
  });

  it("取得に失敗した画像は、もう一度取り、それでも駄目なら飛ばす", async () => {
    const clock = manualClock();
    const calls: Record<string, number> = {};
    const ensure = vi.fn(async (id: string) => {
      calls[id] = (calls[id] ?? 0) + 1;
      if (id === "b") throw new Error("boom");
      if (id === "c" && calls[id] === 1) throw new Error("once");
      return img(id);
    });
    const shownIndexes: number[] = [];
    const stop = runSlideshow(spec, { listImageIds: async () => ["a", "b", "c"], ensure, sleep: clock.sleep }, (_b, i) => shownIndexes.push(i));
    await vi.waitFor(() => expect(shownIndexes).toEqual([0]));
    await clock.tick();
    await clock.tick();
    await vi.waitFor(() => expect(shownIndexes).toEqual([0, 2]));
    stop();
  });

  it("画像が1枚だけなら、1度表示して終わる", async () => {
    const clock = manualClock();
    const onShow = vi.fn();
    runSlideshow(spec, { listImageIds: async () => ["only"], ensure: async (id) => img(id), sleep: clock.sleep }, onShow);
    await vi.waitFor(() => expect(onShow).toHaveBeenCalledOnce());
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it("画像が無ければ何も表示しない", async () => {
    const clock = manualClock();
    const onShow = vi.fn();
    const ensure = vi.fn();
    runSlideshow(spec, { listImageIds: async () => [], ensure, sleep: clock.sleep }, onShow);
    await new Promise((r) => setTimeout(r, 10));
    expect(onShow).not.toHaveBeenCalled();
    expect(ensure).not.toHaveBeenCalled();
  });

  it("stop のあとは、取得が届いても表示しない", async () => {
    const clock = manualClock();
    const gate = deferred<Blob>();
    const onShow = vi.fn();
    const stop = runSlideshow(spec, { listImageIds: async () => ["a", "b"], ensure: () => gate.promise, sleep: clock.sleep }, onShow);
    await new Promise((r) => setTimeout(r, 10));
    stop();
    gate.resolve(img("a"));
    await new Promise((r) => setTimeout(r, 10));
    expect(onShow).not.toHaveBeenCalled();
  });
});

describe("folderImageLister", () => {
  const dir = "octopus-scheduler/assets/f";
  const entry = (id: string, name: string, mime: string, directoryId?: string): AssetRecordEntry => ({
    id,
    name,
    mime,
    hash: "h".repeat(32),
    size: 1,
    uploadedAt: "",
    lastUpdated: "",
    ...(directoryId ? { directoryId } : {}),
  });

  it("この端末の一覧にあるそのフォルダの画像を、名前順に使う(ほかのフォルダ・画像以外・フォルダなしは除く)", async () => {
    const readEntries = vi.fn(async () => [
      entry("2", "b.png", "image/png", dir),
      entry("1", "a.png", "image/png", dir),
      entry("3", "song.mp3", "audio/mpeg", dir),
      entry("4", "z.png", "image/png", "octopus-scheduler/assets/other"),
      entry("5", "top.png", "image/png"),
    ]);
    expect(await folderImageLister({ readEntries })("f")).toEqual(["1", "2"]);
  });

  it("MIME タイプが空の素材は、拡張子で画像かどうかを決める", async () => {
    const readEntries = async () => [entry("1", "a.JPG", "", dir), entry("2", "memo.txt", "", dir)];
    expect(await folderImageLister({ readEntries })("f")).toEqual(["1"]);
  });

  it("まだアップロードされていない素材(ホストにだけある)も使える。サーバーも中身も見ない", async () => {
    // 一覧(readEntries)だけを渡す。サーバーへ行く手段は、そもそも渡していない
    const readEntries = async () => [entry("local-only", "new.png", "image/png", dir)];
    expect(await folderImageLister({ readEntries })("f")).toEqual(["local-only"]);
  });

  it("そのフォルダに画像が無ければ、空", async () => {
    expect(await folderImageLister({ readEntries: async () => [] })("f")).toEqual([]);
  });
});
