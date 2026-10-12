import { describe, expect, it } from "vitest";
import { enterTriggers, resolveConsoleKey } from "../console-keys";
import type { KeyContext, KeyLike } from "../console-keys";
import type { MainAction } from "../console-guidance";

const key = (over: Partial<KeyLike> = {}): KeyLike => ({
  key: "Enter",
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  target: document.body,
  ...over,
});
const ctx = (over: Partial<KeyContext> = {}): KeyContext => ({ mainAction: { kind: "advance" }, blocked: false, ...over });

describe("コントロール画面のEnterキー", () => {
  it.each<[string, MainAction]>([
    ["次へ(advance)", { kind: "advance" }],
    ["画面の切り替え(navigate)", { kind: "navigate", path: "/jackpot-draw" }],
  ])("%s の主ボタンは Enter で押せる", (_name, action) => {
    expect(resolveConsoleKey(key(), ctx({ mainAction: action }))).toBe("main");
    expect(enterTriggers(action)).toBe(true);
  });

  it("受付の締切(closeAnswers)は Enter では押せない(誤操作で回答を打ち切らない)", () => {
    const action: MainAction = { kind: "closeAnswers" };
    expect(resolveConsoleKey(key(), ctx({ mainAction: action }))).toBeNull();
    expect(enterTriggers(action)).toBe(false);
  });

  it("主ボタンが無いときは何もしない", () => {
    expect(resolveConsoleKey(key(), ctx({ mainAction: null }))).toBeNull();
    expect(enterTriggers(null)).toBe(false);
  });

  it("送信中・未接続(blocked)のときは何もしない", () => {
    expect(resolveConsoleKey(key(), ctx({ blocked: true }))).toBeNull();
  });

  it("Enter 以外のキーは無視する", () => {
    for (const k of [" ", "Escape", "ArrowRight", "Backspace", "a"]) expect(resolveConsoleKey(key({ key: k }), ctx())).toBeNull();
  });

  it("押しっぱなし(repeat)は無視する(連打で何度も進めない)", () => {
    expect(resolveConsoleKey(key({ repeat: true }), ctx())).toBeNull();
  });

  it.each(["ctrlKey", "metaKey", "altKey", "shiftKey"] as const)("%s 付きは無視する", (mod) => {
    expect(resolveConsoleKey(key({ [mod]: true }), ctx())).toBeNull();
  });

  it.each(["input", "textarea", "select", "button", "a", "summary"])("<%s> にフォーカスがあるときは、その要素の操作を優先して無視する", (tag) => {
    const el = document.createElement(tag);
    expect(resolveConsoleKey(key({ target: el }), ctx())).toBeNull();
  });

  it("編集可能な要素(contenteditable)でも無視する", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "isContentEditable", { value: true });
    expect(resolveConsoleKey(key({ target: el }), ctx())).toBeNull();
  });

  it("通常の要素・発生元が無いときは押せる", () => {
    expect(resolveConsoleKey(key({ target: document.createElement("div") }), ctx())).toBe("main");
    expect(resolveConsoleKey(key({ target: null }), ctx())).toBe("main");
  });
});
