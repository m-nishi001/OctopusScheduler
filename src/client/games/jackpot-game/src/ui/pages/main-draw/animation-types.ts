export interface AnimationRef {
  startSpin?: (bgm1Url?: Blob | null) => void;
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
    bgm1Url: Blob | null;
    bgm2Url: Blob | null;
  }) => Promise<void>;
}
