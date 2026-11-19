import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEdgeColor } from "./load-edge-color";

/** 画像の読み込みを即座に成功/失敗させる Image の代役。 */
function stubImage(outcome: "load" | "error") {
  class FakeImage {
    naturalWidth = 2;
    naturalHeight = 2;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_: string) {
      queueMicrotask(() => (outcome === "load" ? this.onload?.() : this.onerror?.()));
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

const stubCanvas = (ctx: unknown) =>
  vi.spyOn(document, "createElement").mockImplementation(() => ({ width: 0, height: 0, getContext: () => ctx }) as unknown as HTMLElement);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadEdgeColor", () => {
  it("縁の色を #rrggbb で返す", async () => {
    stubImage("load");
    const data = new Uint8ClampedArray(2 * 2 * 4).fill(0x43);
    stubCanvas({ drawImage: () => undefined, getImageData: () => ({ data, width: 2, height: 2 }) });
    expect(await loadEdgeColor("blob:x")).toBe("#434343");
  });

  it("画像を読めない・キャンバスが使えない・別のオリジンで読み取りが拒否されるときは null(例外にしない)", async () => {
    stubImage("error");
    expect(await loadEdgeColor("blob:x")).toBeNull();
    stubImage("load");
    stubCanvas(null);
    expect(await loadEdgeColor("blob:x")).toBeNull();
    stubCanvas({
      drawImage: () => undefined,
      getImageData: () => {
        throw new DOMException("tainted", "SecurityError");
      },
    });
    expect(await loadEdgeColor("https://example.com/x.png")).toBeNull();
  });
});
