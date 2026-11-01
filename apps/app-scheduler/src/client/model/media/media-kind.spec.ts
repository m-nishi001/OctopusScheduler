import { describe, expect, it } from "vitest";
import { classifyMedia } from "./media-kind";

describe("classifyMedia", () => {
  it.each([
    ["image/png", "a.bin", "image"],
    ["video/mp4", "a.bin", "video"],
    ["audio/mpeg", "a.bin", "audio"],
    ["IMAGE/JPEG", "", "image"],
  ] as const)("MIME タイプ %s を先に見る", (mime, name, expected) => {
    expect(classifyMedia(mime, name)).toBe(expected);
  });

  it.each([
    ["", "photo.JPG", "image"],
    [undefined, "a.webp", "image"],
    ["application/octet-stream", "clip.webm", "video"],
    ["", "song.m4a", "audio"],
  ] as const)("MIME タイプが当てにならないときは拡張子で決める (%s, %s)", (mime, name, expected) => {
    expect(classifyMedia(mime, name)).toBe(expected);
  });

  it("MIME タイプが合えば、拡張子は見ない", () => {
    expect(classifyMedia("audio/mpeg", "picture.png")).toBe("audio");
  });

  it.each([["", ""], ["text/html", "page.html"], [undefined, undefined], ["", "noext"]] as const)("どれでもなければ file (%s, %s)", (mime, name) => {
    expect(classifyMedia(mime, name)).toBe("file");
  });
});
