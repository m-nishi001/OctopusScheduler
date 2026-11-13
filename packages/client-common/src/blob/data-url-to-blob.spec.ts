import { describe, expect, it } from "vitest";
import { dataUrlToBlob } from "./data-url-to-blob";

const bytesOf = async (blob: Blob) => Array.from(new Uint8Array(await blob.arrayBuffer()));

describe("dataUrlToBlob", () => {
  it("全てのバイト値(パディングの有無・長さの余りが違うものも)を、元のバイト列と種類の Blob に戻す", async () => {
    for (const length of [0, 1, 2, 3, 4, 5, 256, 1001]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 7 + 3) % 256);
      const url = `data:video/mp4;base64,${Buffer.from(bytes).toString("base64")}`;
      const blob = dataUrlToBlob(url);
      expect(blob.type).toBe("video/mp4");
      expect(await bytesOf(blob)).toEqual(Array.from(bytes));
    }
  });

  it("種類が無ければ application/octet-stream", () => {
    expect(dataUrlToBlob(",QUJD").type).toBe("application/octet-stream");
  });
});
