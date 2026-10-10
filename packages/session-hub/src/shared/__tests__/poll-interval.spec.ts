import { describe, expect, it } from "vitest";
import { POLL_POLICIES, computeNextPollMs } from "../poll-interval";
import { DEVICE_ROLES } from "../session-types";

describe("computeNextPollMs", () => {
  it.each(DEVICE_ROLES)("%s: 活動直後は activeMs、静穏が長いほど延びて idleMaxMs で頭打ち", (role) => {
    const { activeMs, idleMaxMs } = POLL_POLICIES[role];
    expect(computeNextPollMs(role, 0)).toBe(activeMs);
    expect(computeNextPollMs(role, 20_000)).toBe(activeMs);
    const mid = computeNextPollMs(role, 50_000);
    expect(mid).toBeGreaterThan(activeMs);
    expect(mid).toBeLessThan(idleMaxMs);
    expect(computeNextPollMs(role, 80_000)).toBe(idleMaxMs);
    expect(computeNextPollMs(role, 24 * 3600 * 1000)).toBe(idleMaxMs);
  });

  it("経過時間に対して単調非減少", () => {
    let prev = 0;
    for (let t = 0; t <= 120_000; t += 5_000) {
      const v = computeNextPollMs("client", t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("役割が軽いほど(host < admin < client)間隔が長い", () => {
    expect(POLL_POLICIES.host.activeMs).toBeLessThan(POLL_POLICIES.admin.activeMs);
    expect(POLL_POLICIES.admin.activeMs).toBeLessThan(POLL_POLICIES.client.activeMs);
    expect(POLL_POLICIES.host.idleMaxMs).toBeLessThan(POLL_POLICIES.client.idleMaxMs);
  });
});
