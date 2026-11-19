import { describe, expect, it } from "vitest";
import { edgeColor, type PixelData } from "./edge-color";

const image = (width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): PixelData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { data, width, height };
};

describe("edgeColor", () => {
  it("全面が同じ色(#434343)なら、その色を返す", () => {
    expect(edgeColor(image(8, 6, () => [0x43, 0x43, 0x43, 255]))).toBe("#434343");
  });

  it("縁の中央値を使う。中身の色や、縁の少数の外れ値には引きずられない", () => {
    const img = image(10, 10, (x, y) => {
      if (x === 0 && y === 0) return [255, 255, 255, 255]; // 縁の外れ値
      const onEdge = x === 0 || y === 0 || x === 9 || y === 9;
      return onEdge ? [0x10, 0x20, 0x30, 255] : [200, 0, 0, 255];
    });
    expect(edgeColor(img)).toBe("#102030");
  });

  it("透明度は見ない", () => {
    expect(edgeColor(image(4, 4, () => [0x43, 0x43, 0x43, 0]))).toBe("#434343");
  });

  it("1×1・1行・1列の小さい画像でも求まる", () => {
    expect(edgeColor(image(1, 1, () => [1, 2, 3, 255]))).toBe("#010203");
    expect(edgeColor(image(5, 1, () => [9, 9, 9, 255]))).toBe("#090909");
    expect(edgeColor(image(1, 4, () => [255, 0, 128, 255]))).toBe("#ff0080");
  });

  it("画素が無い・データが足りないときは null", () => {
    expect(edgeColor({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toBeNull();
    expect(edgeColor({ data: new Uint8ClampedArray(4), width: 4, height: 4 })).toBeNull();
  });
});
