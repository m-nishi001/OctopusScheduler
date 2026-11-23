import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import octopusSchedulerRoutes from "../../ui/router";
import { MAX_STATE_BYTES } from "@octopus/session-hub";
import { MEDIA_SLICE_BUDGET_BYTES, type CatalogItem } from "./media-catalog";
import {
  MAX_PLAYBACK_AUDIO,
  PLAYBACK_SLICE_BUDGET_BYTES,
  UNKNOWN_ASSET_NAME,
  buildPlaybackSlice,
  describeNowPlaying,
  parsePlaybackSlice,
  readPlaybackSlice,
  readSessionPath,
  screenFromPath,
} from "./now-playing";
import type { ScreenSpec } from "./screen-spec";

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const item = (id: string, name: string, kind: CatalogItem["kind"] = "audio"): CatalogItem => ({ id, name, kind, folder: "" });

describe("screenFromPath: 実際のルート定義と対にして固定する", () => {
  /** ホストの `router.afterEach` が公開する `to.fullPath` を、実際のルーターで作る。 */
  const router = createRouter({ history: createMemoryHistory(), routes: octopusSchedulerRoutes as never });
  const fullPathOf = async (to: Parameters<typeof router.push>[0]) => {
    await router.push(to);
    return router.currentRoute.value.fullPath;
  };

  it("show-image / show-video の画面(名前で遷移したときと、旧パスからの振り替えのどちらも)", async () => {
    const image = await fullPathOf({ name: "show-image", params: { id: "img-1_A" } });
    expect(image).toBe("/execute/show-image/img-1_A");
    expect(screenFromPath(image)).toEqual({ kind: "image", id: "img-1_A" });
    expect(screenFromPath(await fullPathOf({ name: "show-video", params: { id: "vid1" } }))).toEqual({ kind: "video", id: "vid1" });
    expect(screenFromPath(await fullPathOf("/show-video/vid2"))).toEqual({ kind: "video", id: "vid2" });
    expect(screenFromPath(await fullPathOf("/show-image/img3"))).toEqual({ kind: "image", id: "img3" });
  });

  it("show-slideshow の画面。指定(JSON)は、フォルダ名に日本語や記号があっても読める", async () => {
    for (const folder of ["slides", "結婚式 写真/2", "a?b#c%d"]) {
      const spec: ScreenSpec = { kind: "slideshow", folder, intervalSec: 4, transition: "slide" };
      const path = await fullPathOf({ name: "show-slideshow", params: { data: JSON.stringify(spec) } });
      expect(path.startsWith("/execute/show-slideshow/")).toBe(true);
      // フォルダ名に / を含む指定は、指示の検証(parseScreenSpec)が受け付けないので、スクリーンにも出ない
      expect(screenFromPath(path)).toEqual(folder.includes("/") ? null : spec);
    }
  });

  it("スクリーン以外の画面は null(ロビー・ゲームの画面・待機画面)", async () => {
    for (const path of ["/session/host/s1", "/execute", "/execute/jackpot-entry", "/execute/quiz/q1/entry", "/home", "/event-entry"]) {
      expect(screenFromPath(path)).toBeNull();
    }
  });
});

describe("screenFromPath: 外から来たパス", () => {
  it.each([
    [null],
    [undefined],
    [""],
    ["/execute/show-image/"],
    ["/execute/show-image/a/b"],
    ["/execute/show-image/%E0%A4%A"], // 壊れたエンコード
    ["/execute/show-slideshow/not-json"],
    ["/execute/show-slideshow/" + encodeURIComponent(JSON.stringify({ kind: "image", id: "x" }))], // スライドショー以外の指定
    ["/execute/show-slideshow/" + encodeURIComponent(JSON.stringify({ kind: "slideshow", folder: "f", intervalSec: 0, transition: "fade" }))],
    ["/show-image/a"], // 振り替え前のパスは、公開される fullPath には現れない
  ])("%j は null", (path) => {
    expect(screenFromPath(path as string | null | undefined)).toBeNull();
  });

  it("クエリやハッシュが付いていても読める", () => {
    expect(screenFromPath("/execute/show-image/a1?x=1")).toEqual({ kind: "image", id: "a1" });
  });
});

describe("parsePlaybackSlice(信頼境界)", () => {
  it("正しい状態を読む。余分な項目は捨てる", () => {
    expect(parsePlaybackSlice({ audio: [{ assetId: "a1", loop: true, extra: 1 }, { assetId: "b2", loop: false }], other: 1 })).toEqual({
      audio: [{ assetId: "a1", loop: true }, { assetId: "b2", loop: false }],
    });
  });

  it("形が違えば null", () => {
    for (const v of [null, undefined, 1, "x", [], {}, { audio: "a" }, { audio: {} }]) expect(parsePlaybackSlice(v)).toBeNull();
  });

  it("不正な項目(素材 ID の形・loop の型)と、同じ素材の重複は捨てる", () => {
    expect(
      parsePlaybackSlice({ audio: [{ assetId: "../x", loop: false }, { assetId: "a", loop: "yes" }, null, { assetId: "ok", loop: false }, { assetId: "ok", loop: true }, { loop: true }] })
    ).toEqual({ audio: [{ assetId: "ok", loop: false }] });
  });

  it(`${MAX_PLAYBACK_AUDIO} 件を超えた分は読まない`, () => {
    const audio = Array.from({ length: MAX_PLAYBACK_AUDIO + 5 }, (_, i) => ({ assetId: `a${i}`, loop: false }));
    expect(parsePlaybackSlice({ audio })?.audio).toHaveLength(MAX_PLAYBACK_AUDIO);
  });

  it("ルーム状態の data から、playback と session.path を読む", () => {
    const data = { playback: { audio: [{ assetId: "a", loop: false }] }, session: { path: "/execute/show-image/x" } };
    expect(readPlaybackSlice(data)).toEqual({ audio: [{ assetId: "a", loop: false }] });
    expect(readSessionPath(data)).toBe("/execute/show-image/x");
    expect(readPlaybackSlice(null)).toBeNull();
    expect(readSessionPath({ session: { path: 1 } })).toBeNull();
    expect(readSessionPath(undefined)).toBeNull();
  });
});

describe("buildPlaybackSlice と、ルーム状態の予算", () => {
  const worst = Array.from({ length: MAX_PLAYBACK_AUDIO + 4 }, (_, i) => ({ assetId: `${i}`.padEnd(64, "x"), loop: true }));

  it(`件数は ${MAX_PLAYBACK_AUDIO} 件まで。素材 ID が最長(64 文字)でも、割り当て(${PLAYBACK_SLICE_BUDGET_BYTES} バイト)に収まる`, () => {
    const slice = buildPlaybackSlice(worst);
    expect(slice.audio).toHaveLength(MAX_PLAYBACK_AUDIO);
    expect(bytes(slice)).toBeLessThanOrEqual(PLAYBACK_SLICE_BUDGET_BYTES);
  });

  it(`素材の一覧(media)と合わせても、ルーム状態の ${MAX_STATE_BYTES} バイトの半分以下で、画面・イベント・クイズ・結果の分を残す`, () => {
    expect(MEDIA_SLICE_BUDGET_BYTES + PLAYBACK_SLICE_BUDGET_BYTES).toBeLessThanOrEqual(MAX_STATE_BYTES / 2);
  });

  it("公開の形は、読み取り側(parsePlaybackSlice)でそのまま読める", () => {
    const slice = buildPlaybackSlice([{ assetId: "a", loop: false }]);
    expect(parsePlaybackSlice(slice)).toEqual(slice);
  });
});

describe("describeNowPlaying", () => {
  const catalog = [item("a1", "bgm.mp3"), item("i1", "photo.png", "image"), item("v1", "clip.mp4", "video")];

  it("曲は名前とループの印、画面は種類と名前の行にする", () => {
    const view = describeNowPlaying({ audio: [{ assetId: "a1", loop: true }] }, { kind: "image", id: "i1" }, catalog);
    expect(view).toEqual({
      audio: [{ assetId: "a1", name: "bgm.mp3", loop: true }],
      screen: { kind: "image", kindLabel: "画像", name: "photo.png" },
    });
    expect(describeNowPlaying(null, { kind: "video", id: "v1" }, catalog).screen).toEqual({ kind: "video", kindLabel: "動画", name: "clip.mp4" });
  });

  it("スライドショーは、フォルダ名を名前にする", () => {
    const screen = describeNowPlaying(null, { kind: "slideshow", folder: "show1", intervalSec: 5, transition: "fade" }, catalog).screen;
    expect(screen).toEqual({ kind: "slideshow", kindLabel: "スライドショー", name: "show1" });
  });

  it("一覧に無い素材も、行は出す(名前の分からない素材として)", () => {
    const view = describeNowPlaying({ audio: [{ assetId: "gone", loop: false }] }, { kind: "image", id: "gone" }, catalog);
    expect(view.audio[0]).toEqual({ assetId: "gone", name: UNKNOWN_ASSET_NAME, loop: false });
    expect(view.screen?.name).toBe(UNKNOWN_ASSET_NAME);
  });

  it("何も無ければ、空の曲と null の画面", () => {
    expect(describeNowPlaying(null, null, catalog)).toEqual({ audio: [], screen: null });
  });
});
