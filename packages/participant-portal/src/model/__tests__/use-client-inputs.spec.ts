import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { Command } from "@octopus/session-hub";
import { tick } from "@octopus/session-hub/testing";
import { useClientInputs } from "../use-client-inputs";
import type { ClientInputs } from "../use-client-inputs";
import { usePortalSession } from "../use-portal-session";
import type { PortalSession } from "../use-portal-session";
import { ALICE, participantDevice, portalEnv } from "../../__tests__/portal-test-kit";
import type { Device } from "../../__tests__/portal-test-kit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

async function connect(device: Device) {
  let session!: PortalSession;
  let inputs!: ClientInputs;
  const app = createApp(
    defineComponent({
      setup() {
        session = usePortalSession(device.conn);
        inputs = useClientInputs(session);
        return () => h("div");
      },
    })
  );
  app.mount(document.createElement("div"));
  await session.join();
  await tick(5000);
  return { session, inputs, unmount: () => app.unmount() };
}

const STOP = { phase: "member", canStop: true, member: null, prize: null };

describe("useClientInputs", () => {
  it("ホストが受け付けている操作だけが出て、受付が終わると消える", async () => {
    const env = await portalEnv();
    const alice = await connect(participantDevice(env.hub, ALICE));
    expect(alice.inputs.inputs.value).toEqual([]);

    await env.publishJackpot(STOP, ["jackpot.stopRoulette"]);
    await tick(5000);
    expect(alice.inputs.inputs.value).toEqual(["jackpot.stopRoulette"]);

    await env.publishJackpot({ ...STOP, canStop: false }, []);
    await tick(5000);
    expect(alice.inputs.inputs.value).toEqual([]);
    alice.unmount();
  });

  it("押すと、ホストへコマンドとして届き、「送信しました」と出る", async () => {
    const env = await portalEnv();
    const seen: Command[] = [];
    env.host.conn.onCommand((c) => void seen.push(c));
    const alice = await connect(participantDevice(env.hub, ALICE));
    await env.publishJackpot(STOP, ["jackpot.stopRoulette"]);
    await tick(5000);

    await alice.inputs.send("jackpot.stopRoulette");
    await tick(5000);
    expect(alice.inputs.message.value).toBe("送信しました");
    expect(seen.map((c) => [c.game, c.type, c.issuerRole])).toEqual([["jackpot", "stopRoulette", "client"]]);
    alice.unmount();
  });

  it("送信中は他の送信を受け付けず、連打しても1件だけ", async () => {
    const env = await portalEnv();
    const seen: Command[] = [];
    env.host.conn.onCommand((c) => void seen.push(c));
    const alice = await connect(participantDevice(env.hub, ALICE));
    await env.publishJackpot(STOP, ["jackpot.stopRoulette"]);
    await tick(5000);

    await Promise.all([alice.inputs.send("jackpot.stopRoulette"), alice.inputs.send("jackpot.stopRoulette"), alice.inputs.send("jackpot.stopRoulette")]);
    await tick(5000);
    expect(seen).toHaveLength(1);
    expect(alice.inputs.busyKey.value).toBeNull();
    alice.unmount();
  });

  it("受付が終わったあとに押すと、受付終了の案内を出し、コマンドは届かない", async () => {
    const env = await portalEnv();
    const seen: Command[] = [];
    env.host.conn.onCommand((c) => void seen.push(c));
    const alice = await connect(participantDevice(env.hub, ALICE));
    await env.publishJackpot(STOP, ["jackpot.stopRoulette"]);
    await tick(5000);
    // ホストが受付を終えたが、参加者の画面にはまだ反映されていない
    await env.publishJackpot({ ...STOP, canStop: false }, []);

    await alice.inputs.send("jackpot.stopRoulette");
    await tick(5000);
    expect(alice.inputs.message.value).toBe("受付が終了しました");
    expect(seen).toEqual([]);
    alice.unmount();
  });

  it("形の合わない操作のキーは何も送らない", async () => {
    const env = await portalEnv();
    const device = participantDevice(env.hub, ALICE);
    const alice = await connect(device);
    await alice.inputs.send("nodot");
    await alice.inputs.send(".x");
    await alice.inputs.send("x.");
    expect(device.api.calls.issueCommand ?? 0).toBe(0);
    alice.unmount();
  });
});
