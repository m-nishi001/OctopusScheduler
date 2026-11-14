import { describe, expect, it } from "vitest";
import { buildTimeline, countLines, pageAt, pageCount, pageWindowHeight, PAGE_SLIDE_SEC, sampleTimeline, type TimelineItem } from "./sequence-timeline";

const M = { viewportHeight: 1000, contentHeight: 300, lineHeight: 50 };
const item = (over: Partial<TimelineItem>): TimelineItem => ({ kind: "テキスト", effect: "静止", seconds: 4, lines: 3, ...over });

describe("sequence-timeline: 行数とページ", () => {
  it("折り返しを含む高さから行数を数える(最低1行)", () => {
    expect(countLines(300, 50)).toBe(6);
    expect(countLines(0, 50)).toBe(1);
    expect(countLines(100, 0)).toBe(1);
  });
  it("ページ数は行数を1ページの行数で割って切り上げる", () => {
    expect(pageCount(6, 3)).toBe(2);
    expect(pageCount(7, 3)).toBe(3);
    expect(pageCount(1, 3)).toBe(1);
    expect(pageWindowHeight(3, 50)).toBe(150);
  });
});

describe("sequence-timeline: 効果ごとの動き", () => {
  it("静止: 動かず、秒数のあいだ出している", () => {
    const t = buildTimeline(item({ effect: "静止", seconds: 4 }), M);
    expect(t.duration).toBe(4);
    expect(sampleTimeline(t, 0)).toEqual({ y: 0, opacity: 1 });
    expect(sampleTimeline(t, 4)).toEqual({ y: 0, opacity: 1 });
  });

  it("フェード: 現れて、保って、消える。出入りの長さは秒数の1/3まで", () => {
    const t = buildTimeline(item({ effect: "フェード", seconds: 4 }), M);
    expect(sampleTimeline(t, 0).opacity).toBe(0);
    expect(sampleTimeline(t, 0.4).opacity).toBeCloseTo(0.5);
    expect(sampleTimeline(t, 2).opacity).toBe(1);
    expect(sampleTimeline(t, 4).opacity).toBe(0);
    const short = buildTimeline(item({ effect: "フェード", seconds: 1.5 }), M);
    expect(sampleTimeline(short, 0.5).opacity).toBe(1);
  });

  it("流れる: 画面の下の外から上の外まで、一定の速さで全体を上へ流す", () => {
    const t = buildTimeline(item({ effect: "流れる", seconds: 10 }), M);
    const travel = 1000 / 2 + 300 / 2;
    expect(sampleTimeline(t, 0).y).toBe(travel);
    expect(sampleTimeline(t, 5).y).toBeCloseTo(0);
    expect(sampleTimeline(t, 10).y).toBe(-travel);
    expect(sampleTimeline(t, 2.5).y).toBeCloseTo(travel / 2);
  });

  it("流れる: 長い文章ほど長い距離を、同じ秒数で流れる", () => {
    const short = buildTimeline(item({ effect: "流れる", seconds: 10 }), M);
    const long = buildTimeline(item({ effect: "流れる", seconds: 10 }), { ...M, contentHeight: 2000 });
    expect(Math.abs(sampleTimeline(long, 10).y)).toBeGreaterThan(Math.abs(sampleTimeline(short, 10).y));
  });

  it("行送り: lines 行ずつ、seconds 秒おきに上へ送る(6行を3行ずつ = 2ページ)", () => {
    const t = buildTimeline(item({ effect: "行送り", seconds: 4, lines: 3 }), M);
    expect(t.pages).toBe(2);
    expect(t.duration).toBeCloseTo(2 * 4 + PAGE_SLIDE_SEC);
    // 1ページ目は seconds 秒の間そのまま
    expect(sampleTimeline(t, 0).y).toBe(0);
    expect(sampleTimeline(t, 3.99).y).toBe(0);
    // 送り終えると 3行ぶん(150px)上
    expect(sampleTimeline(t, 4 + PAGE_SLIDE_SEC).y).toBe(-150);
    // 最後のページも seconds 秒保ってから終わる
    expect(sampleTimeline(t, t.duration - 0.1).y).toBe(-150);
    expect(sampleTimeline(t, t.duration).y).toBe(-150);
    expect(t.keyframes[t.keyframes.length - 1].t).toBe(t.duration);
  });

  it("行送り: 7行を3行ずつなら3ページ。最後のページの行が足りなくても送る量は同じ", () => {
    const t = buildTimeline(item({ effect: "行送り", seconds: 2, lines: 3 }), { ...M, contentHeight: 350 });
    expect(t.pages).toBe(3);
    expect(sampleTimeline(t, t.duration).y).toBe(-300);
  });

  it("行送り: 1ページに収まるなら送らない", () => {
    const t = buildTimeline(item({ effect: "行送り", seconds: 3, lines: 5 }), { ...M, contentHeight: 150 });
    expect(t.pages).toBe(1);
    expect(t.duration).toBe(3);
    expect(sampleTimeline(t, 3).y).toBe(0);
  });

  it("行送り: どのページがいつ見えているか", () => {
    const t = buildTimeline(item({ effect: "行送り", seconds: 4, lines: 3 }), M);
    expect(pageAt(t, 0)).toBe(0);
    expect(pageAt(t, 3.9)).toBe(0);
    expect(pageAt(t, 4 + PAGE_SLIDE_SEC)).toBe(1);
    expect(pageAt(t, t.duration)).toBe(1);
  });

  it("行送りは画像には使えない(静止と同じ)", () => {
    const t = buildTimeline(item({ kind: "画像", effect: "行送り", seconds: 3 }), M);
    expect(t.pages).toBe(1);
    expect(sampleTimeline(t, 1.5)).toEqual({ y: 0, opacity: 1 });
  });

  it("秒数が 0 以下でも、止まらない長さになる", () => {
    expect(buildTimeline(item({ seconds: 0 }), M).duration).toBeGreaterThan(0);
  });

  it("範囲の外の時刻は両端の値", () => {
    const t = buildTimeline(item({ effect: "流れる", seconds: 10 }), M);
    expect(sampleTimeline(t, -5).y).toBe(sampleTimeline(t, 0).y);
    expect(sampleTimeline(t, 99).y).toBe(sampleTimeline(t, 10).y);
  });
});
