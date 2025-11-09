export interface AnimationRef {
  startSpin?: (bgmUrl?: Blob | null) => void;
  stopSpin?: {
    (
      durationSec?: number,
      targetPrizeId?: string | null
    ): Promise<string | null>;
  };
}
