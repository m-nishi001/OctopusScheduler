import { describe, expect, it } from "vitest";
import { clientInputAllows, clientInputKeysFor } from "../session-types";
import type { ClientInput } from "../session-types";

const STOP = "jackpot.stopRoulette";
const ANSWER = "quiz.answer";
const taro = { memberId: "taro" };
const hanako = { memberId: "hanako" };

describe("clientInputAllows(サーバーの受付とポータルの表示が共有する判定)", () => {
  const inputs: ClientInput[] = [{ key: STOP, memberIds: ["taro"] }, { key: ANSWER }];

  it("公開されていない操作は誰も送れない", () => {
    expect(clientInputAllows(inputs, "jackpot.advance", taro)).toBe(false);
    expect(clientInputAllows([], STOP, taro)).toBe(false);
  });

  it("宛先の指定がなければ全員が送れる", () => {
    expect(clientInputAllows(inputs, ANSWER, taro)).toBe(true);
    expect(clientInputAllows(inputs, ANSWER, hanako)).toBe(true);
    expect(clientInputAllows(inputs, ANSWER, { memberId: null })).toBe(true);
  });

  it("宛先が決まっていれば、宛先の本人だけが送れる", () => {
    expect(clientInputAllows(inputs, STOP, taro)).toBe(true);
    expect(clientInputAllows(inputs, STOP, hanako)).toBe(false);
  });

  it("宛先つきは、memberId なしでは送れない", () => {
    expect(clientInputAllows(inputs, STOP, { memberId: null })).toBe(false);
  });

  it("clientInputKeysFor は、送れる操作のキーだけを公開順に返す", () => {
    expect(clientInputKeysFor(inputs, taro)).toEqual([STOP, ANSWER]);
    expect(clientInputKeysFor(inputs, hanako)).toEqual([ANSWER]);
    expect(clientInputKeysFor([], taro)).toEqual([]);
  });
});
