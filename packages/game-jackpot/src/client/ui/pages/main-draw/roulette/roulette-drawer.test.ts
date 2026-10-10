import { describe, it, expect, vi } from "vitest";
import { drawWheel } from "./roulette-drawer";

function fakeCtx() {
  const gradient = { addColorStop: vi.fn() };
  return new Proxy(
    { createRadialGradient: () => gradient, drawImage: vi.fn() } as any,
    { get: (t, k) => (k in t ? t[k] : vi.fn()), set: () => true }
  ) as CanvasRenderingContext2D & { drawImage: ReturnType<typeof vi.fn> };
}

const item = (id: string) => ({ id, imageElement: { naturalWidth: 10, naturalHeight: 10 } as any }) as any;

describe("drawWheel", () => {
  /** 景品が8個未満(1〜7個)でも例外にならず、8分割すべてに画像が描かれること。 */
  it.each([1, 2, 3, 7])("項目が%d個でも落ちずに全扇を描く", (n) => {
    const ctx = fakeCtx();
    const canvas = { width: 800, height: 800 } as HTMLCanvasElement;
    const items = Array.from({ length: n }, (_, i) => item(`p${i}`));
    expect(() => drawWheel(0, items, ctx, canvas)).not.toThrow();
    expect(ctx.drawImage).toHaveBeenCalledTimes(8);
  });

  it("項目が0個でも落ちない", () => {
    const ctx = fakeCtx();
    expect(() => drawWheel(0, [], ctx, { width: 800, height: 800 } as HTMLCanvasElement)).not.toThrow();
  });
});
