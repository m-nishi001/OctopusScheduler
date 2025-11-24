export class MainScreenSetting {
  readonly type: "main" = "main";
  memberLotteryBgms: string[];

  memberDrawRequestCount: number;

  kakuhenMode: "random" | "fixed";
  kakuhenFixedTimings: number[];
  kakuhenReservedCount: number;

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
