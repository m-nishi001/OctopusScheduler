export interface AnimationRef {
  startSpin?: (bgmAssetUrl?: string | null) => void;
  stopSpin?: (opts?: {
    decelerationFunction?: (
      elapsed: number,
      totalTime: number,
      initialSpeed: number
    ) => number;
  }) => Promise<string | null>;
  runAutoReroll?: (opts: {
    dummyPrizeId: string | null;
    finalPrizeId: string | null;
    dummyDuration: number;
    finalDuration: number;
    bgm1Url: string | null;
    bgm2Url: string | null;
  }) => Promise<void>;
}
