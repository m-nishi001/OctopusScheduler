import { describe, expect, it, vi } from "vitest";
import type { Asset } from "@model/asset/asset";
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
  const asset = (id: string, name: string, type: string, directoryId?: string): Asset => ({
    id,
    name,
    blob: new Blob(["x"], { type }),
    uploadedAt: "",
    lastUpdated: "",
    size: 1,
    directoryId,
  });

  it("この端末にあるそのフォルダの画像を、名前順に使う(ほかのフォルダや画像以外は除く)。サーバーへは行かない", async () => {
    const store = {
      getAssets: async () => [
        asset("2", "b.png", "image/png", dir),
        asset("1", "a.png", "image/png", dir),
        asset("3", "song.mp3", "audio/mpeg", dir),
        asset("4", "z.png", "image/png", "octopus-scheduler/assets/other"),
        asset("5", "top.png", "image/png"),
      ],
      listRemote: vi.fn(),
    };
    const ids = await folderImageLister(store, vi.fn())("f");
    expect(ids).toEqual(["1", "2"]);
    expect(store.listRemote).not.toHaveBeenCalled();
  });

  it("手元に無いときだけ、サーバーの一覧を使い、中身の種類で画像だけを選ぶ", async () => {
    const store = {
      getAssets: async () => [],
      listRemote: vi.fn(async () => [
        { driveDataId: "i2", fileId: `${dir}/i2_b.png`, parentFolderId: dir, lastUpdate: "" },
        { driveDataId: "t1", fileId: `${dir}/t1_note.txt`, parentFolderId: dir, lastUpdate: "" },
        { driveDataId: "i1", fileId: `${dir}/i1_a.png`, parentFolderId: dir, lastUpdate: "" },
      ]),
    };
    const ensure = vi.fn(async (id: string, _fileId?: string) => (id.startsWith("i") ? img(id) : new Blob(["t"], { type: "text/plain" })));
    const ids = await folderImageLister(store, ensure)("f");
    expect(store.listRemote).toHaveBeenCalledWith("f");
    expect(ids).toEqual(["i1", "i2"]);
    expect(ensure).toHaveBeenCalledWith("i1", `${dir}/i1_a.png`);
  });

  it("取れなかった素材は、一覧に入れない", async () => {
    const store = {
      getAssets: async () => [],
      listRemote: async () => [{ driveDataId: "x", fileId: `${dir}/x_a.png`, parentFolderId: dir, lastUpdate: "" }],
    };
    expect(await folderImageLister(store, async () => { throw new Error("no"); })("f")).toEqual([]);
  });
});
