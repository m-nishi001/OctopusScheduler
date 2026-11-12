import { describe, it, expect } from "vitest";
import { DEFAULT_PARTICIPANT_STOP, parseParticipantStop } from "./participant-stop";

describe("parseParticipantStop（保存された画面設定から、参加者が止められるかを取り出す）", () => {
  it("設定が無い・形が違う・boolean 以外のときは既定(止められる)", () => {
    expect(DEFAULT_PARTICIPANT_STOP).toBe(true);
    for (const settings of [null, undefined, "x", 3, {}, { participantStop: null }, { participantStop: "false" }, { participantStop: 0 }, { participantStop: {} }]) {
      expect(parseParticipantStop(settings)).toBe(true);
    }
  });

  it("保存された true / false をそのまま取り出す", () => {
    expect(parseParticipantStop({ participantStop: true })).toBe(true);
    expect(parseParticipantStop({ participantStop: false })).toBe(false);
  });
});
