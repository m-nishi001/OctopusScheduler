export interface AnimationRef {
  startSpin?: (bgmUrl?: Blob | null) => void;
  stopSpin?: (
    durationSec?: number,
    targetPrizeId?: string | null,
    occurrence?: number,
    bgmUrl?: Blob | null
  ) => Promise<string | null>;
}
