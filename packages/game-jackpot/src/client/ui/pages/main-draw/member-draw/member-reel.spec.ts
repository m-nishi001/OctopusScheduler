import { describe, expect, it } from "vitest";
import type { MemberDto } from "@control/member/dto/member-dto";
import { REEL_REPEAT, buildReelLap, emptyReelMember, reelScale, repeatReel, startButtonCenterY } from "./member-reel";

const member = (id: string): MemberDto => ({ id, name: id.toUpperCase(), rank: 5 }) as MemberDto;
const ids = (list: MemberDto[]) => list.map((m) => m.id);

describe("buildReelLap", () => {
  const others = ["a", "b", "c"].map(member);

  it("当選者は、乱数で決まる位置に入る(先頭・途中・末尾)", () => {
    expect(ids(buildReelLap(others, member("w"), 4, () => 0))).toEqual(["w", "a", "b", "c"]);
    expect(ids(buildReelLap(others, member("w"), 4, () => 0.3))).toEqual(["a", "w", "b", "c"]);
    expect(ids(buildReelLap(others, member("w"), 4, () => 0.999))).toEqual(["a", "b", "c", "w"]);
  });

  it("当選者がいなければ、並べたまま", () => {
    expect(ids(buildReelLap(others, null, 3, () => 0))).toEqual(["a", "b", "c"]);
  });

  it("表示数に満たなければ、空の枠(---)で埋める。多ければ削らない", () => {
    const lap = buildReelLap(others, null, 5, () => 0);
    expect(ids(lap)).toEqual(["a", "b", "c", "empty-3", "empty-4"]);
    expect(lap[3]).toMatchObject({ name: "---" });
    expect(buildReelLap(others, null, 1, () => 0)).toHaveLength(3);
  });

  it("unique を指定すると同じ id を1つにまとめる(最初のものを残す)", () => {
    const dup = [member("a"), member("b"), member("a")];
    expect(ids(buildReelLap(dup, null, 3, () => 0, { unique: true }))).toEqual(["a", "b"]);
    expect(ids(buildReelLap(dup, null, 3, () => 0))).toEqual(["a", "b", "a"]);
  });

  it("渡した配列を書き換えない", () => {
    const input = [member("a")];
    buildReelLap(input, member("w"), 3, () => 0);
    expect(ids(input)).toEqual(["a"]);
  });
});

describe("repeatReel", () => {
  it("1周を REEL_REPEAT 回つなげる", () => {
    const lap = ["a", "b"].map(member);
    const reel = repeatReel(lap);
    expect(reel).toHaveLength(2 * REEL_REPEAT);
    expect(ids(reel).slice(0, 4)).toEqual(["a", "b", "a", "b"]);
  });
});

describe("emptyReelMember", () => {
  it("位置ごとに別の id", () => {
    expect(emptyReelMember(2).id).toBe("empty-2");
    expect(emptyReelMember(3).id).toBe("empty-3");
  });
});

describe("reelScale", () => {
  it("中央(距離0)で最大、influence 以上離れると最小、途中は線形", () => {
    expect(reelScale(0, 400)).toBe(1.8);
    expect(reelScale(400, 400)).toBe(0.8);
    expect(reelScale(2000, 400)).toBe(0.8);
    expect(reelScale(200, 400)).toBe(1.3);
  });

  it("influence が0でも割り算で壊れない", () => {
    expect(reelScale(0, 0)).toBe(1.8);
    expect(reelScale(10, 0)).toBe(0.8);
  });
});

describe("startButtonCenterY", () => {
  it("枠の中心と画面下端の中間に、少し下へ寄せて置く", () => {
    // 中間 = (300 + 1000) / 2 = 650、+40 = 690
    expect(startButtonCenterY(300, 1000, 60)).toBe(690);
  });

  it("画面の外に出ないよう、下端から余白(ボタン半分 + 12)を残して収める", () => {
    expect(startButtonCenterY(990, 1000, 60)).toBe(1000 - 30 - 12);
  });

  it("上にも出ない", () => {
    // 中間は0より上だが、ボタン半分 + 余白 の 42 までは上がらない。そこから 40 下へ寄せる
    expect(startButtonCenterY(-1000, 1000, 60)).toBe(30 + 12 + 40);
  });
});
