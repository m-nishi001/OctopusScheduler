import { vi } from "vitest";
import { createTestHub } from "./test-hub";
import type { TestHub } from "./test-hub";
import { createFakeHubApi, NO_FAULTS } from "./fake-hub-api";
import type { FaultInjector, FakeHubApi } from "./fake-hub-api";
import { MemoryDeviceStore } from "../client/model/device-store";
import { DEFAULT_POLLING_OPTIONS, PollingTransport, realTimers } from "../client/model/polling-transport";
import type { PollingOptions } from "../client/model/polling-transport";
import { SessionConnection } from "../client/model/session-connection";
import type { ConnectionOptions } from "../client/model/session-connection";

/** vitest の fake timers の現在時刻を使う時計。advance は時刻だけ進め、タイマーは発火させない。 */
export const dateClock = {
  now: (): number => Date.now(),
  advance: (ms: number): void => {
    vi.setSystemTime(Date.now() + ms);
  },
};

export const noJitterTimers = { ...realTimers, random: () => 0.5 };

export interface Device {
  api: FakeHubApi;
  store: MemoryDeviceStore;
  transport: PollingTransport;
  conn: SessionConnection;
}

export interface DeviceOptions {
  memberId?: string | null;
  faults?: FaultInjector;
  store?: MemoryDeviceStore;
  polling?: Partial<PollingOptions>;
  connection?: Partial<ConnectionOptions>;
}

export function makeDevice(hub: TestHub, options: DeviceOptions = {}): Device {
  const api = createFakeHubApi(hub, options.memberId ?? null, options.faults ?? NO_FAULTS);
  const store = options.store ?? new MemoryDeviceStore();
  const transport = new PollingTransport(api, noJitterTimers, { ...DEFAULT_POLLING_OPTIONS, ...options.polling });
  let n = 0;
  const conn = new SessionConnection({
    api,
    store,
    transport,
    now: dateClock.now,
    newRequestId: () => `req-${Math.random().toString(36).slice(2)}-${++n}`,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    ...options.connection,
  });
  return { api, store, transport, conn };
}

export function makeHub(): TestHub {
  return createTestHub({ clock: dateClock });
}

/** 時間を進めつつ、非同期処理(ポーリング・コマンド適用)を流し切る。 */
export async function tick(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}
