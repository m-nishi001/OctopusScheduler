import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { DriveMetadata } from "@octopus/infrastructures/compositions";
import MediaPanel from "../components/media-panel.vue";
import { toasts } from "../../../../../../../../packages/ui-kit/src/composables/use-feedback";

const ROOT = "octopus-scheduler/assets";
const meta = (id: string, fileName: string, parent = ROOT): DriveMetadata => ({ driveDataId: id, fileId: `${parent}/${id}_${fileName}`, parentFolderId: parent, lastUpdate: "", fileName });

const METAS = [
  meta("song1", "bgm.mp3"),
  meta("song2", "fanfare.wav"),
  meta("img1", "photo.png"),
  meta("vid1", "clip.mp4"),
  meta("s1", "slide1.jpg", `${ROOT}/show1`),
  meta("doc1", "memo.txt"),
];

function mountPanel(options: { canSend?: boolean; loadMetas?: () => Promise<DriveMetadata[]>; roomData?: Record<string, unknown> | null } = {}) {
  const issue = vi.fn(async (..._args: unknown[]) => undefined);
  const wrapper = mount(MediaPanel, {
    props: { connection: { issue } as never, canSend: options.canSend ?? true, loadMetas: options.loadMetas ?? (async () => METAS), roomData: options.roomData },
  });
  return { wrapper, issue };
}

const find = (wrapper: ReturnType<typeof mount>, id: string) => wrapper.find(`[data-testid="${id}"]`);

beforeEach(() => {
  toasts.value = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("media-panel: 音楽", () => {
  it("曲の一覧を表示名で出す(音楽以外は出さない)", async () => {
    const { wrapper } = mountPanel();
    await flushPromises();
    expect(wrapper.findAll('[data-testid="media-song"]').map((r) => r.text())).toEqual(expect.arrayContaining([expect.stringContaining("bgm.mp3"), expect.stringContaining("fanfare.wav")]));
    expect(wrapper.findAll('[data-testid="media-song"]')).toHaveLength(2);
    expect(wrapper.text()).not.toContain("photo.png");
  });

  it("再生・停止・すべて停止で、media の指示を送る", async () => {
    const { wrapper, issue } = mountPanel();
    await flushPromises();
    await find(wrapper, "media-play-song1").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenLastCalledWith("media", "play", { assetId: "song1" });
    await find(wrapper, "media-stop-song1").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenLastCalledWith("media", "stop", { assetId: "song1", fadeSec: 1 });
    await find(wrapper, "media-stop-all").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenLastCalledWith("media", "stop", { fadeSec: 1 });
  });

  it("送れない間(接続していない)は押せない", async () => {
    const { wrapper, issue } = mountPanel({ canSend: false });
    await flushPromises();
    expect(find(wrapper, "media-play-song1").attributes("disabled")).toBeDefined();
    await find(wrapper, "media-play-song1").trigger("click");
    expect(issue).not.toHaveBeenCalled();
  });

  it("素材が無いときは案内を出す", async () => {
    const { wrapper } = mountPanel({ loadMetas: async () => [meta("img1", "photo.png")] });
    await flushPromises();
    expect(wrapper.text()).toContain("音楽の素材がありません");
  });
});

describe("media-panel: スクリーン", () => {
  async function screenTab(options?: Parameters<typeof mountPanel>[0]) {
    const result = mountPanel(options);
    await flushPromises();
    await find(result.wrapper, "media-tab-screen").trigger("click");
    return result;
  }

  it("画像・動画だけを一覧にし、押すと表示の指示を送る", async () => {
    const { wrapper, issue } = await screenTab();
    expect(wrapper.findAll('[data-testid="media-visual"]')).toHaveLength(3);
    await find(wrapper, "media-show-img1").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenLastCalledWith("media", "show", { spec: { kind: "image", id: "img1" } });
    await find(wrapper, "media-show-vid1").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenLastCalledWith("media", "show", { spec: { kind: "video", id: "vid1" } });
  });

  it("「消す」で clear を送る", async () => {
    const { wrapper, issue } = await screenTab();
    await find(wrapper, "media-clear").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenLastCalledWith("media", "clear", {});
  });

  it("フォルダ(一覧から作る)を選ぶか手で入力して、スライドショーを開始できる", async () => {
    const { wrapper, issue } = await screenTab();
    const options = find(wrapper, "media-folder-select").findAll("option").map((o) => o.text());
    expect(options).toContain("show1");
    expect(find(wrapper, "media-slideshow-start").attributes("disabled")).toBeDefined();

    await find(wrapper, "media-folder-select").setValue("show1");
    await find(wrapper, "media-interval").setValue("8");
    await find(wrapper, "media-transition").setValue("slide");
    await find(wrapper, "media-slideshow-start").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenLastCalledWith("media", "show", { spec: { kind: "slideshow", folder: "show1", intervalSec: 8, transition: "slide" } });

    // 手入力が優先
    await find(wrapper, "media-folder-input").setValue("manual-dir");
    await find(wrapper, "media-slideshow-start").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenLastCalledWith("media", "show", { spec: { kind: "slideshow", folder: "manual-dir", intervalSec: 8, transition: "slide" } });
  });

  it("フォルダ名や秒数が正しくなければ開始できない", async () => {
    const { wrapper } = await screenTab();
    await find(wrapper, "media-folder-input").setValue("a/b");
    expect(find(wrapper, "media-slideshow-start").attributes("disabled")).toBeDefined();
    await find(wrapper, "media-folder-input").setValue("ok");
    await find(wrapper, "media-interval").setValue("0");
    expect(find(wrapper, "media-slideshow-start").attributes("disabled")).toBeDefined();
    await find(wrapper, "media-interval").setValue("61");
    expect(find(wrapper, "media-slideshow-start").attributes("disabled")).toBeDefined();
    await find(wrapper, "media-interval").setValue("60");
    expect(find(wrapper, "media-slideshow-start").attributes("disabled")).toBeUndefined();
  });
});

describe("media-panel: 読み込み", () => {
  it("一覧を取れなかったときは知らせ、再読み込みで取り直せる", async () => {
    const loadMetas = vi.fn<() => Promise<DriveMetadata[]>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(METAS);
    const { wrapper } = mountPanel({ loadMetas });
    await flushPromises();
    expect(find(wrapper, "media-error").exists()).toBe(true);
    await find(wrapper, "media-reload").trigger("click");
    await flushPromises();
    expect(find(wrapper, "media-error").exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="media-song"]')).toHaveLength(2);
    expect(loadMetas).toHaveBeenCalledTimes(2);
  });

  it("送信に失敗したら通知する(例外を外に出さない)", async () => {
    const { wrapper, issue } = mountPanel();
    await flushPromises();
    issue.mockRejectedValueOnce(new Error("offline"));
    await find(wrapper, "media-play-song1").trigger("click");
    await flushPromises();
    expect(toasts.value.length).toBeGreaterThan(0);
  });
});

describe("media-panel: ホストが公開した差(アップロード前の素材)", () => {
  const slice = (over: Record<string, unknown> = {}) => ({ media: { rev: 1, pending: [], removedIds: [], truncated: 0, ...over } });
  const pendingSong = { id: "newsong", name: "aaa-new.mp3", kind: "audio", folder: "" };

  it("サーバーの一覧に、アップロード前の素材を足して出し、再生の指示も送れる(アップロードを待たない)", async () => {
    const { wrapper, issue } = mountPanel({ roomData: slice({ pending: [pendingSong] }) });
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="media-song"]').map((r) => r.text());
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("aaa-new.mp3"); // 名前順
    await find(wrapper, "media-play-newsong").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenLastCalledWith("media", "play", { assetId: "newsong" });
  });

  it("ホストが消した素材は出さない。サーバーの一覧にも載った素材は重ねて出さない", async () => {
    const { wrapper } = mountPanel({ roomData: slice({ pending: [{ id: "song1", name: "bgm.mp3", kind: "audio", folder: "" }], removedIds: ["song2"] }) });
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="media-song"]').map((r) => r.text());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("bgm.mp3");
  });

  it("ホストの公開が無い(古いホスト・まだ公開していない)ときは、サーバーの一覧だけ", async () => {
    const { wrapper } = mountPanel({ roomData: {} });
    await flushPromises();
    expect(wrapper.findAll('[data-testid="media-song"]')).toHaveLength(2);
  });

  it("番号(rev)が変わったら、再読み込みを押さなくても、サーバーの一覧を読み直す。変わらなければ読まない", async () => {
    const loadMetas = vi.fn(async () => METAS);
    const { wrapper } = mountPanel({ loadMetas, roomData: slice({ rev: 1 }) });
    await flushPromises();
    expect(loadMetas).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ roomData: slice({ rev: 1, pending: [pendingSong] }) });
    await flushPromises();
    expect(loadMetas).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ roomData: slice({ rev: 2 }) });
    await flushPromises();
    expect(loadMetas).toHaveBeenCalledTimes(2);
    expect(wrapper.findAll('[data-testid="media-song"]')).toHaveLength(2);
  });

  it("アップロードが済んで番号が変わると、重複せずサーバーの一覧の1件になる", async () => {
    let metas = METAS;
    const loadMetas = vi.fn(async () => metas);
    const { wrapper } = mountPanel({ loadMetas, roomData: slice({ rev: 1, pending: [pendingSong] }) });
    await flushPromises();
    expect(wrapper.findAll('[data-testid="media-song"]')).toHaveLength(3);
    metas = [...METAS, meta("newsong", "aaa-new.mp3")];
    await wrapper.setProps({ roomData: slice({ rev: 2, pending: [] }) });
    await flushPromises();
    expect(wrapper.findAll('[data-testid="media-song"]')).toHaveLength(3);
    expect(wrapper.text().match(/aaa-new\.mp3/g)).toHaveLength(1);
  });

  it("読み込み中に番号が変わったら、終わってからもう1回だけ読む", async () => {
    let release!: () => void;
    const loadMetas = vi.fn(() => new Promise<DriveMetadata[]>((resolve) => (release = () => resolve(METAS))));
    const { wrapper } = mountPanel({ loadMetas, roomData: slice({ rev: 1 }) });
    await flushPromises();
    await wrapper.setProps({ roomData: slice({ rev: 2 }) });
    await wrapper.setProps({ roomData: slice({ rev: 3 }) });
    expect(loadMetas).toHaveBeenCalledTimes(1);
    release();
    await flushPromises();
    expect(loadMetas).toHaveBeenCalledTimes(2);
    release();
    await flushPromises();
    expect(loadMetas).toHaveBeenCalledTimes(2);
  });

  it("載せきれなかった件数(truncated)を知らせる。0なら出さない", async () => {
    const { wrapper } = mountPanel({ roomData: slice({ truncated: 7 }) });
    await flushPromises();
    expect(find(wrapper, "media-truncated").text()).toContain("7 件");
    await wrapper.setProps({ roomData: slice({ truncated: 0 }) });
    expect(find(wrapper, "media-truncated").exists()).toBe(false);
  });

  it("ホストで再生できなかった素材を知らせる。次の指示を送るまで見せ、開いた時点で既にあった失敗は見せない", async () => {
    const { wrapper, issue } = mountPanel({ roomData: slice({ lastError: { assetId: "old", at: 1 } }) });
    await flushPromises();
    expect(find(wrapper, "media-playback-error").exists()).toBe(false);

    await wrapper.setProps({ roomData: slice({ lastError: { assetId: "song1", at: 2 } }) });
    expect(find(wrapper, "media-playback-error").text()).toContain("bgm.mp3");

    // 一覧に無い素材は、id で知らせる
    await wrapper.setProps({ roomData: slice({ lastError: { assetId: "ghost", at: 3 } }) });
    expect(find(wrapper, "media-playback-error").text()).toContain("ghost");

    await find(wrapper, "media-play-song1").trigger("click");
    await flushPromises();
    expect(issue).toHaveBeenCalled();
    expect(find(wrapper, "media-playback-error").exists()).toBe(false);

    await wrapper.setProps({ roomData: slice({ lastError: { assetId: "song2", at: 4 } }) });
    expect(find(wrapper, "media-playback-error").text()).toContain("fanfare.wav");
  });
});
