export interface AnimationRef {
  startSpin?: (bgm1Url?: Blob | null) => void;
  stopSpin?: {
    (
      durationSec?: number,
      targetPrizeId?: string | null
    ): Promise<string | null>;
  };
}
