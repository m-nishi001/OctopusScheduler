// MainScreenSetting is a concrete data class for the main screen.
export class MainScreenSetting {
  readonly type: "main" = "main";
  // BGM ids for member lottery
  memberLotteryBgms: string[];

  // how many candidate items the member draw request will ask for (UI default)
  memberDrawRequestCount: number;
  // how many candidate items the prize draw request will ask for (UI default)
  // NOTE: prize-draw specific settings (prizeDrawRequestCount, dummyCount, kakuhen durations)
  // are now handled per-animation and removed from this global screen setting.

  // kakuhen (確変) mode: 'random' or 'fixed'
  kakuhenMode: "random" | "fixed";
  // when kakuhenMode === 'fixed', use these draw indices (1-based) to trigger kakuhen
  kakuhenFixedTimings: number[];
  // how many reserved prizes to keep (application previously used up to 4: 2 high + 2 low)
  kakuhenReservedCount: number;

  // durations used by UI during kakuhen reroll (ms)
  // (removed) kakuhen durations are handled by the prize animation component

  // global BGM volume 0..1
  globalBgmVolume: number;

  constructor(
    memberLotteryBgms: string[] = [],
    memberDrawRequestCount = 10,
    kakuhenMode: "random" | "fixed" = "random",
    kakuhenFixedTimings: number[] = [],
    kakuhenReservedCount = 4,
    globalBgmVolume = 1
  ) {
    this.memberLotteryBgms = memberLotteryBgms;
    this.memberDrawRequestCount = memberDrawRequestCount;
    this.kakuhenMode = kakuhenMode;
    this.kakuhenFixedTimings = kakuhenFixedTimings;
    this.kakuhenReservedCount = kakuhenReservedCount;
    this.globalBgmVolume = globalBgmVolume;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("memberLotteryBgms", JSON.stringify(this.memberLotteryBgms));
    records.set("memberDrawRequestCount", String(this.memberDrawRequestCount));
    records.set("kakuhenMode", this.kakuhenMode);
    records.set(
      "kakuhenFixedTimings",
      JSON.stringify(this.kakuhenFixedTimings)
    );
    records.set("kakuhenReservedCount", String(this.kakuhenReservedCount));
    records.set("globalBgmVolume", String(this.globalBgmVolume));
    return records;
  }

  static fromRecords(records: Map<string, string>): MainScreenSetting {
    const memberLotteryBgms = JSON.parse(
      records.get("memberLotteryBgms") || "[]"
    );
    const memberDrawRequestCount = parseInt(
      records.get("memberDrawRequestCount") || "10"
    );
    const kakuhenMode =
      (records.get("kakuhenMode") as "random" | "fixed") || "random";
    const kakuhenFixedTimings = JSON.parse(
      records.get("kakuhenFixedTimings") || "[]"
    );
    const kakuhenReservedCount = parseInt(
      records.get("kakuhenReservedCount") || "4"
    );
    const globalBgmVolume = parseFloat(records.get("globalBgmVolume") || "1");

    return new MainScreenSetting(
      memberLotteryBgms,
      memberDrawRequestCount,
      kakuhenMode,
      kakuhenFixedTimings,
      kakuhenReservedCount,
      globalBgmVolume
    );
  }
}
