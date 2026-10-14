import { describe, expect, it } from "vitest";
import { describeHostPresence } from "../connection-labels";

const NOW = 1_700_000_000_000;

describe("describeHostPresence", () => {
  it("ホストが居なければ未接続", () => {
    expect(describeHostPresence(null, NOW)).toEqual({ text: "ホスト未接続", online: false });
  });

  it("WebSocket 接続中(live)は、seenAtMs が古くても接続中", () => {
    expect(describeHostPresence({ seenAtMs: NOW - 120_000, live: true }, NOW)).toEqual({ text: "ホスト接続中", online: true });
  });

  it("ポーリング由来は 20 秒までが接続中", () => {
    expect(describeHostPresence({ seenAtMs: NOW - 20_000 }, NOW).online).toBe(true);
  });

  it("ポーリング由来は 20 秒を超えると途絶として経過秒を出す", () => {
    expect(describeHostPresence({ seenAtMs: NOW - 21_000 }, NOW)).toEqual({ text: "ホストの応答が21秒途絶えています", online: false });
  });
});
