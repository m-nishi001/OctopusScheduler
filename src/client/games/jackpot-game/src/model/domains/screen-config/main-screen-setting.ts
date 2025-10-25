// MainScreenSetting is a concrete data class for the main screen.
export class MainScreenSetting {
  readonly type: "main" = "main";
  memberLotteryBgms: string[];
  variableTiming: number;

  constructor(memberLotteryBgms: string[], variableTiming: number) {
    this.memberLotteryBgms = memberLotteryBgms;
    this.variableTiming = variableTiming;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("memberLotteryBgms", JSON.stringify(this.memberLotteryBgms));
    // prizeLotteryMusics removed
    records.set("variableTiming", this.variableTiming.toString());
    // prizeAnimations removed
    return records;
  }

  static fromRecords(records: Map<string, string>): MainScreenSetting {
    const memberLotteryBgms = JSON.parse(
      records.get("memberLotteryBgms") || "[]"
    );
    const variableTiming = parseInt(records.get("variableTiming") || "1");
    return new MainScreenSetting(memberLotteryBgms, variableTiming);
  }
}
