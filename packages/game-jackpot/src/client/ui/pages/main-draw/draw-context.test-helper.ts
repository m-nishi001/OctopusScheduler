import { ref } from "vue";
import { vi } from "vitest";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import type { DrawContext } from "./draw-context";

/** テスト用の DrawContext。演出コンポーネント(テンプレート ref)は vi.fn の偽物。 */
export function createTestContext(overrides: Record<string, unknown> = {}) {
  const selectedPrize = ref<any>(null);
  const prizes = ref<any[]>([]);
  const ctx = {
    phase: ref("idle"),
    result: ref<any>({ wonMember: { id: "m1", name: "Alice" }, wonPrize: { id: "p1", name: "Prize" }, isKakuhen: false }),
    prizeRes: ref<any>(null),
    prizeCounts: ref<any>({ total: 10, before: 8, after: 7 }),
    prizes,
    selectedPrize,
    setSelectedPrize: vi.fn((p: any) => {
      selectedPrize.value = p;
    }),
    preparePrizes: vi.fn().mockResolvedValue([{ id: "prepared" }]),
    loadBgmBlob: vi.fn().mockResolvedValue(null),
    sound: new SoundSystem(new FakeSoundBackend()),
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
    prizeLotteryBgm: { playRandom: vi.fn(), fadeOut: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined) },
    memberStopSec: 3.5,
    prizeStopSec: 4,
    ...overrides,
  };
  return ctx as typeof ctx & DrawContext;
}
