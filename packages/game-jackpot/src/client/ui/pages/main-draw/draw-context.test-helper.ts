import { ref } from "vue";
import { vi } from "vitest";
import type { DrawContext } from "./draw-context";

/** テスト用の DrawContext。演出コンポーネント(テンプレート ref)は vi.fn の偽物。 */
export function createTestContext(overrides: Record<string, unknown> = {}) {
  const selectedPrize = ref<any>(null);
  const prizes = ref<any[]>([]);
  const ctx = {
    drawService: { getLastPrizeCount: vi.fn().mockResolvedValue({ total: 10, remaining: 7 }) },
    phase: ref("idle"),
    result: ref<any>({ wonMember: { id: "m1", name: "Alice" }, wonPrize: { id: "p1", name: "Prize" }, isKakuhen: false }),
    prizeRes: ref<any>(null),
    prizes,
    selectedPrize,
    setSelectedPrize: vi.fn((p: any) => {
      selectedPrize.value = p;
    }),
    preparePrizes: vi.fn().mockResolvedValue([{ id: "prepared" }]),
    loadBgmBlob: vi.fn().mockResolvedValue(null),
    memberAnim: ref<any>({ startDraw: vi.fn(), stopDraw: vi.fn().mockResolvedValue(undefined) }),
    prizeAnim: ref<any>({
      startSpin: vi.fn(),
      stopSpin: vi.fn().mockResolvedValue(undefined),
      updatePrizes: vi.fn().mockResolvedValue(undefined),
      getInternalItems: vi.fn(() => []),
    }),
    showPrizeWinningDialog: ref(false),
    showHalfRemainingDialog: ref(false),
    kakuhenOverlayVisible: ref(false),
    ...overrides,
  };
  return ctx as typeof ctx & DrawContext;
}
