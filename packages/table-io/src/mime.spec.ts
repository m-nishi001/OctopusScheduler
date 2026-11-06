import { describe, expect, it } from "vitest";
import { extensionOfMime, mimeOfName } from "./mime";

describe("mime", () => {
  it("拡張子から MIME、MIME から拡張子", () => {
    expect(mimeOfName("A.PNG")).toBe("image/png");
    expect(mimeOfName("bgm.wav")).toBe("audio/wav");
    expect(mimeOfName("noext")).toBe("application/octet-stream");
    expect(extensionOfMime("image/jpeg")).toBe(".jpg");
    expect(extensionOfMime("x/y")).toBe("");
  });
});
