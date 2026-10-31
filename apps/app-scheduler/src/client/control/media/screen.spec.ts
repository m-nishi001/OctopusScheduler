import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ScreenControl } from "./screen";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup(lobby: string | null = "/session/host/s1") {
  const router = { push: vi.fn(async (_to: unknown) => undefined) };
  const source = { ensure: vi.fn(async (id: string) => new Blob([id])) };
  return { router, source, screen: new ScreenControl(source, router, () => lobby) };
}

describe("ScreenControl.show", () => {
  it("画像・動画は、素材を取ってから、その画面へ移る", async () => {
    const { screen, router, source } = setup();
    await screen.show({ kind: "image", id: "a1" });
    expect(source.ensure).toHaveBeenCalledWith("a1");
    expect(router.push).toHaveBeenLastCalledWith({ name: "show-image", params: { id: "a1" } });
    await screen.show({ kind: "video", id: "v1" });
    expect(router.push).toHaveBeenLastCalledWith({ name: "show-video", params: { id: "v1" } });
  });

  it("スライドショーは、指定をそのまま渡して画面へ移る", async () => {
    const { screen, router } = setup();
    const spec = { kind: "slideshow", folder: "f", intervalSec: 4, transition: "fade" } as const;
    await screen.show(spec);
    expect(router.push).toHaveBeenCalledWith({ name: "show-slideshow", params: { data: JSON.stringify(spec) } });
  });

  it("素材の取得を待つ間に、後から出した指示が来たら、古い指示は捨てる(最後に出した1つだけが映る)", async () => {
    const { screen, router, source } = setup();
    const slow = deferred<Blob>();
    source.ensure.mockReturnValueOnce(slow.promise);
    const first = screen.show({ kind: "image", id: "slow" });
    await screen.show({ kind: "image", id: "fast" });
    slow.resolve(new Blob(["slow"]));
    await first;
    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith({ name: "show-image", params: { id: "fast" } });
  });

  it("取得を待つ間に、スライドショーの指示が来ても、古い画像は出ない", async () => {
    const { screen, router, source } = setup();
    const slow = deferred<Blob>();
    source.ensure.mockReturnValueOnce(slow.promise);
    const first = screen.show({ kind: "video", id: "slow" });
    await screen.show({ kind: "slideshow", folder: "f", intervalSec: 3, transition: "slide" });
    slow.resolve(new Blob(["x"]));
    await first;
    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push.mock.calls[0][0]).toMatchObject({ name: "show-slideshow" });
  });

  it("取得を待つ間に clear が来たら、遅れて届いても出さない", async () => {
    const { screen, router, source } = setup();
    const slow = deferred<Blob>();
    source.ensure.mockReturnValueOnce(slow.promise);
    const shown = screen.show({ kind: "image", id: "slow" });
    await screen.clear();
    slow.resolve(new Blob(["x"]));
    await shown;
    expect(router.push).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith("/session/host/s1");
  });

  it("素材が取れなかったら、画面は変えず、例外で知らせる", async () => {
    const { screen, router, source } = setup();
    source.ensure.mockRejectedValueOnce(new Error("offline"));
    await expect(screen.show({ kind: "image", id: "a" })).rejects.toThrow("offline");
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("ScreenControl.clear", () => {
  it("セッションのホスト画面(ロビー)へ戻す。直前にいた画面は覚えない", async () => {
    const { screen, router } = setup("/session/host/abc");
    await screen.show({ kind: "image", id: "a" });
    await screen.clear();
    expect(router.push).toHaveBeenLastCalledWith("/session/host/abc");
    await screen.clear();
    expect(router.push).toHaveBeenLastCalledWith("/session/host/abc");
  });

  it("ホストとして接続していないときは、何も映さない待機画面へ戻す", async () => {
    const { screen, router } = setup(null);
    await screen.clear();
    expect(router.push).toHaveBeenCalledWith("/execute");
  });
});
