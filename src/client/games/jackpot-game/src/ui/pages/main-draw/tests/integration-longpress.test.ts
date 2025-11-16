/* @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import createInputController from "../input-controller";

describe("Enter long-press flow (harness)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances actions with held Enter and respects 1s dialog gating", async () => {
    const ic = createInputController({ minIntervalMs: 1000 });

    // simplified orchestrator harness state
    const state: any = { phase: "idle", currentAction: null };

    const events: string[] = [];

    // Simulated component/service behaviors
    const member = {
      startDraw: (id: string | null) => {
        events.push("member:start");
        // after start, next action will be memberStop
        state.currentAction = memberStop;
      },
      stopDraw: async () => {
        events.push("member:stop:start");
        // simulate animation stop and then show internal winner dialog
        await new Promise((r) => setTimeout(r, 10));
        events.push("member:dialog:shown");
        // after a short delay emit selected
        await new Promise((r) => setTimeout(r, 10));
        events.push("member:selected");
        return "m1";
      },
    };

    const prizeAnim = {
      startSpin: (_: any) => events.push("prize:startSpin"),
      stopSpin: async (_duration: number, prizeId: string | null) => {
        events.push("prize:stop:start");
        await new Promise((r) => setTimeout(r, 10));
        events.push("prize:stopped");
        return prizeId;
      },
    };

    // Orchestrator-like handlers
    const showMemberDraw = () => {
      state.phase = "member";
      state.currentAction = () => {
        member.startDraw(null);
      };
    };

    const memberStop = async () => {
      await member.stopDraw();
      // when member dialog shown, suspend input and schedule prize show after 1s
      // simulate orchestrator handling
      events.push("orchestrator:member-dialog-handled");
      ic.suspend();
      setTimeout(() => {
        state.currentAction = showPrizeDraw;
        ic.resume();
        events.push("orchestrator:enabled-prize");
      }, 1000);
    };

    const showPrizeDraw = () => {
      state.phase = "prize";
      state.currentAction = async () => {
        // start prize animation
        prizeAnim.startSpin(null);
        events.push("orchestrator:prize-started");
      };
    };

    const prizeStop = async () => {
      await prizeAnim.stopSpin(3, "p1");
      // show prize dialog, suspend input and enable close after 1s
      events.push("orchestrator:prize-dialog-shown");
      ic.suspend();
      setTimeout(() => {
        state.currentAction = closeModal;
        ic.resume();
        events.push("orchestrator:enabled-close");
      }, 1000);
    };

    const closeModal = async () => {
      events.push("orchestrator:closeModal");
      state.currentAction = null;
    };

    // Wire input controller to execute current action
    ic.setOnTrigger(() => {
      const action = state.currentAction;
      if (action) {
        // execute (support async)
        void Promise.resolve(action()).catch(() => {});
      } else {
        events.push("no-action");
      }
    });
    ic.attach();

    // start at member
    showMemberDraw();

    // Simulate holding Enter: keydown once
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    // immediate handler should run startMemberDraw
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContain("member:start");

    // advance 1s to trigger repeat -> should call memberStop
    await vi.advanceTimersByTimeAsync(1000);
    // allow member stop internals to run
    await vi.advanceTimersByTimeAsync(20);
    expect(events).toContain("member:stop:start");
    expect(events).toContain("member:dialog:shown");

    // orchestrator scheduled prize enable after 1s; advance that
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toContain("orchestrator:enabled-prize");
    // run the enabled prize action (simulate the held-Enter trigger completing)
    if (typeof state.currentAction === "function") {
      await Promise.resolve(state.currentAction());
    }

    // schedule prize stop by setting currentAction to prizeStop
    state.currentAction = prizeStop;
    // advance interval tick to invoke prizeStop
    await vi.advanceTimersByTimeAsync(1000);
    // allow prize stop internals
    await vi.advanceTimersByTimeAsync(20);
    expect(events).toContain("prize:stopped");

    // prize dialog shown and orchestrator enables close after 1s
    await vi.advanceTimersByTimeAsync(1000);
    // next interval should trigger closeModal
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(10);
    expect(events).toContain("orchestrator:closeModal");

    // cleanup
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
    ic.detach();
  });
});
