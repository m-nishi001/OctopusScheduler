import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  advanceRemoteAction,
  getRemoteControlState,
  setRemoteScreen,
} from "../remote-control-use-cases";

function stubClock(times: number[]) {
  let i = 0;
  return () => times[i++] ?? times[times.length - 1] ?? 0;
}

describe("remote-control-use-cases", () => {
  it("reports a null screen and zero actionSeq before any command is issued", () => {
    const storage = new InMemoryKeyValueStorage();
    const state = getRemoteControlState({ storage, now: stubClock([]) });
    expect(state).toEqual({ screen: null, actionSeq: 0, updatedAtMs: 0 });
  });

  it("sets the target screen and records the update time", () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000]);

    const state = setRemoteScreen({ storage, now }, { screen: "opening" });

    expect(state).toEqual({
      screen: "opening",
      actionSeq: 0,
      updatedAtMs: 1000,
    });
    expect(getRemoteControlState({ storage, now })).toEqual(state);
  });

  it("advances actionSeq by 1 each call without touching the screen", () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000, 2000, 3000]);
    setRemoteScreen({ storage, now }, { screen: "main-draw" });

    const first = advanceRemoteAction({ storage, now });
    const second = advanceRemoteAction({ storage, now });

    expect(first).toEqual({
      screen: "main-draw",
      actionSeq: 1,
      updatedAtMs: 2000,
    });
    expect(second).toEqual({
      screen: "main-draw",
      actionSeq: 2,
      updatedAtMs: 3000,
    });
  });

  it("switching screens preserves the current actionSeq", () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000, 2000, 3000]);
    setRemoteScreen({ storage, now }, { screen: "home" });
    advanceRemoteAction({ storage, now });

    const state = setRemoteScreen({ storage, now }, { screen: "opening" });

    expect(state).toEqual({
      screen: "opening",
      actionSeq: 1,
      updatedAtMs: 3000,
    });
  });
});
