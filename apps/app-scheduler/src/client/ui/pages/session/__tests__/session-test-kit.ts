import "reflect-metadata";
import { vi } from "vitest";
import { container } from "tsyringe";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import {
  HostAgent,
  ISessionHubApiToken,
  SessionAdminRepository,
} from "@octopus/session-hub";
import {
  createFakeHubApi,
  makeDevice,
  makeHub,
} from "@octopus/session-hub/testing";
import type { FaultInjector, TestHub } from "@octopus/session-hub/testing";

/** 時間を進めて非同期処理を流し切る。 */
export async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await flushPromises();
}

const Stub = defineComponent({ render: () => h("div", "stub") });

export function makeRouter(initial = "/") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: Stub },
      { path: "/home", component: Stub },
      { path: "/sessions", component: Stub },
      { path: "/portal/:code?", component: Stub },
      { path: "/session/host/:id", component: Stub },
      { path: "/session/console/:id", component: Stub },
      { path: "/jackpot-opening", component: Stub },
      { path: "/jackpot-ending", component: Stub },
      { path: "/settings", component: Stub },
    ],
  });
  void router.push(initial);
  return router;
}

export interface SessionEnv {
  hub: TestHub;
  /** 管理者(memberId=admin1)としてのAPI。 */
  adminApi: ReturnType<typeof createFakeHubApi>;
  repo: SessionAdminRepository;
}

/** TestHub と DI を用意する。vi.useFakeTimers() 済みで呼ぶこと。 */
export function setupSessionEnv(options: { faults?: FaultInjector; webAppUrl?: string | null } = {}): SessionEnv {
  const hub = makeHub();
  const adminApi = createFakeHubApi(hub, "admin1", options.faults, options.webAppUrl ?? "https://app.example/exec");
  container.register(ISessionHubApiToken, { useValue: adminApi });
  const repo = new SessionAdminRepository(adminApi);
  container.register(SessionAdminRepository, { useValue: repo });
  return { hub, adminApi, repo };
}

/** ホストのエージェントを DI に登録して返す。 */
export function registerHostAgent(env: SessionEnv, memberId = "admin1", faults?: FaultInjector) {
  const device = makeDevice(env.hub, { memberId, faults });
  const agent = new HostAgent(device.conn);
  container.register(HostAgent, { useValue: agent });
  return { agent, device };
}

export { makeDevice, makeHub };
