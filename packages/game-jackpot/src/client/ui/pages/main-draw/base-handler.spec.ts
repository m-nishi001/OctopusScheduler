import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import mitt from "mitt";
import { BaseHandler } from "./base-handler";
import { ActionQueue } from "./action-queue";

function createEmitterSpy() {
  const emitter = mitt<any>();
  const emitted: string[] = [];
  emitter.on("nextAction", () => emitted.push("nextAction"));
  return { emitter, emitted };
}

describe("BaseHandler", () => {
  describe("phase transitions", () => {
    it("setMemberPhase sets drawState.phase to 'member' and emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const drawState: any = { phase: "idle" };

      await BaseHandler.setMemberPhase(drawState, emitter);

      expect(drawState.phase).toBe("member");
      expect(emitted).toEqual(["nextAction"]);
    });

    it("setPrizePhase sets drawState.phase to 'prize' and emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const drawState: any = { phase: "member" };

      await BaseHandler.setPrizePhase(drawState, emitter);

      expect(drawState.phase).toBe("prize");
      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("member winner dialog", () => {
    it("showMemberWinnerDialog opens the dialog and emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showMemberWinnerDialog = ref(false);

      await BaseHandler.showMemberWinnerDialog(showMemberWinnerDialog, emitter);

      expect(showMemberWinnerDialog.value).toBe(true);
      expect(emitted).toEqual(["nextAction"]);
    });

    it("closeMemberWinnerDialog closes the dialog and emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showMemberWinnerDialog = ref(true);

      await BaseHandler.closeMemberWinnerDialog(
        showMemberWinnerDialog,
        emitter
      );

      expect(showMemberWinnerDialog.value).toBe(false);
      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("startMemberDraw", () => {
    it("calls startDraw on the member animation ref with the pre-drawn winner id", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const preDrawResult = ref<any>({ wonMember: { id: "m1" } });
      const startDraw = vi.fn();
      const memberAnimRef = ref<any>({ startDraw });

      await BaseHandler.startMemberDraw(preDrawResult, memberAnimRef, emitter);

      expect(startDraw).toHaveBeenCalledWith("m1");
      expect(emitted).toEqual(["nextAction"]);
    });

    it("still emits nextAction when there is no member animation ref mounted yet", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const preDrawResult = ref<any>({ wonMember: { id: "m1" } });
      const memberAnimRef = ref<any>(null);

      await BaseHandler.startMemberDraw(preDrawResult, memberAnimRef, emitter);

      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("stopMemberDraw", () => {
    it("awaits stopDraw on the member animation ref then emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const stopDraw = vi.fn().mockResolvedValue(undefined);
      const memberAnimRef = ref<any>({ stopDraw });

      await BaseHandler.stopMemberDraw(memberAnimRef, emitter);

      expect(stopDraw).toHaveBeenCalled();
      expect(emitted).toEqual(["nextAction"]);
    });

    it("does not emit nextAction when there is no member animation ref (documents current behavior)", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const memberAnimRef = ref<any>(null);

      await BaseHandler.stopMemberDraw(memberAnimRef, emitter);

      expect(emitted).toEqual([]);
    });
  });

  describe("prize winning dialog", () => {
    it("showPrizeWinningDialogAction opens the dialog and emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showPrizeWinningDialog = ref(false);

      await BaseHandler.showPrizeWinningDialogAction(
        showPrizeWinningDialog,
        emitter
      );

      expect(showPrizeWinningDialog.value).toBe(true);
      expect(emitted).toEqual(["nextAction"]);
    });

    it("closePrizeWinningDialog closes the dialog and emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showPrizeWinningDialog = ref(true);

      await BaseHandler.closePrizeWinningDialog(
        showPrizeWinningDialog,
        emitter
      );

      expect(showPrizeWinningDialog.value).toBe(false);
      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("half-remaining dialog", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("shows the dialog and waits when exactly half the prizes remain", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showHalfRemainingDialog = ref(false);
      const drawService = {
        getLastPrizeCount: vi
          .fn()
          .mockResolvedValue({ total: 10, remaining: 5 }),
      } as any;

      const promise = BaseHandler.showHalfRemainingDialogAction(
        drawService,
        showHalfRemainingDialog,
        emitter
      );
      await vi.runAllTimersAsync();
      await promise;

      expect(showHalfRemainingDialog.value).toBe(true);
      expect(emitted).toEqual(["nextAction"]);
    });

    it("does not show the dialog when remaining is not exactly half of total", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showHalfRemainingDialog = ref(false);
      const drawService = {
        getLastPrizeCount: vi
          .fn()
          .mockResolvedValue({ total: 10, remaining: 3 }),
      } as any;

      await BaseHandler.showHalfRemainingDialogAction(
        drawService,
        showHalfRemainingDialog,
        emitter
      );

      expect(showHalfRemainingDialog.value).toBe(false);
      expect(emitted).toEqual(["nextAction"]);
    });

    it("closeHalfRemainingDialogAction closes the dialog and emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showHalfRemainingDialog = ref(true);

      await BaseHandler.closeHalfRemainingDialogAction(
        showHalfRemainingDialog,
        emitter
      );

      expect(showHalfRemainingDialog.value).toBe(false);
      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("end dialog", () => {
    it("shows the end dialog and clears the queue when no prizes remain", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showEndDialog = ref(false);
      const queue = new ActionQueue();
      queue.enqueue(vi.fn(async () => {}));
      const drawService = {
        getLastPrizeCount: vi
          .fn()
          .mockResolvedValue({ total: 10, remaining: 0 }),
      } as any;

      await BaseHandler.showEndDialogAction(
        showEndDialog,
        drawService,
        queue,
        emitter
      );

      expect(showEndDialog.value).toBe(true);
      expect(queue.isEmpty()).toBe(true);
      expect(emitted).toEqual(["nextAction"]);
    });

    it("does not show the end dialog while prizes remain", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showEndDialog = ref(false);
      const queue = new ActionQueue();
      const drawService = {
        getLastPrizeCount: vi
          .fn()
          .mockResolvedValue({ total: 10, remaining: 4 }),
      } as any;

      await BaseHandler.showEndDialogAction(
        showEndDialog,
        drawService,
        queue,
        emitter
      );

      expect(showEndDialog.value).toBe(false);
      expect(emitted).toEqual(["nextAction"]);
    });

    it("closeEndDialogAction closes the dialog and emits nextAction", async () => {
      const { emitter, emitted } = createEmitterSpy();
      const showEndDialog = ref(true);

      await BaseHandler.closeEndDialogAction(showEndDialog, emitter);

      expect(showEndDialog.value).toBe(false);
      expect(emitted).toEqual(["nextAction"]);
    });
  });

  describe("wait", () => {
    it("resolves after the given number of seconds", async () => {
      vi.useFakeTimers();
      const spy = vi.fn();

      BaseHandler.wait(2).then(spy);
      await vi.advanceTimersByTimeAsync(1999);
      expect(spy).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(spy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("getActions", () => {
    it("composes the full member-draw + prize-draw action cycle without executing it", () => {
      const emitter = mitt<any>();
      const actions = BaseHandler.getActions(
        ref(null),
        ref(null),
        ref(null),
        ref(null),
        ref([]),
        ref(false),
        {} as any,
        ref(false),
        ref(false),
        vi.fn(),
        vi.fn(),
        ref(false),
        new ActionQueue(),
        emitter,
        { phase: "idle" }
      );

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every((a) => typeof a === "function")).toBe(true);
    });
  });
});
