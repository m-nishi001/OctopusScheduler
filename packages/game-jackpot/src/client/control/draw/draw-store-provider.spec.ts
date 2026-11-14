import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import { DrawStoreProvider } from "./draw-store-provider";
import { setDemoDrawScreen, setJackpotScope } from "../../model/jackpot-session";
import type { MemberRepository } from "../../model/member/member-repository";
import type { JackpotRepository } from "../../model/jackpot-repository";

const provider = () => new DrawStoreProvider({} as MemberRepository, {} as JackpotRepository);

afterEach(() => {
  setJackpotScope("live");
  setDemoDrawScreen(false);
});

describe("DrawStoreProvider", () => {
  it("接続が無い実行は、スコープごとに別々のメモリだけの置き場(本番とデモは混ざらない)", () => {
    const p = provider();
    setJackpotScope("live");
    const live = p.current();
    setJackpotScope("demo");
    const demo = p.current();
    expect(live.kind).toBe("rehearsal");
    expect(demo.kind).toBe("rehearsal");
    expect(demo).not.toBe(live);
  });

  it("デモ抽選(練習抽選)の画面は、専用のメモリだけの置き場を使う。本番にも、デモの実行にも混ざらない", () => {
    const p = provider();
    setJackpotScope("live");
    const live = p.current();
    setDemoDrawScreen(true);
    const practice = p.current();
    expect(practice.kind).toBe("rehearsal");
    expect(practice).not.toBe(live);
    expect(p.current()).toBe(practice); // 同じ画面の間は同じ置き場

    setJackpotScope("demo");
    expect(p.current()).toBe(practice); // デモの実行の中の練習も、練習の置き場
    setDemoDrawScreen(false);
    expect(p.current()).not.toBe(practice);
    expect(p.current()).not.toBe(live);
  });
});
