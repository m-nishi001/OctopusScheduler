import { describe, expect, it } from "vitest";
import { EventReturn } from "./event-return";

describe("EventReturn", () => {
  it("覚えるまでは null", () => {
    expect(new EventReturn().take()).toBeNull();
  });

  it("capture した画面を take で返す(取り出しても残る)", () => {
    const r = new EventReturn();
    r.capture("/execute/show-slideshow/x");
    expect(r.take()).toBe("/execute/show-slideshow/x");
    expect(r.take()).toBe("/execute/show-slideshow/x");
  });

  it("あとから capture すると上書きし、clear で忘れる", () => {
    const r = new EventReturn();
    r.capture("/a");
    r.capture("/b");
    expect(r.take()).toBe("/b");
    r.clear();
    expect(r.take()).toBeNull();
  });
});
