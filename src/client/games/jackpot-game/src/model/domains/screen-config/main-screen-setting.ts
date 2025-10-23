// MainScreenSetting is a concrete data class for the main screen.
export class MainScreenSetting {
  readonly type: "main" = "main";
  memberLotteryBgms: string[];
  prizeLotteryMusics: { prizeId: string; primary: string; secondary: string }[];
  variableTiming: number;
  prizeAnimations: { prizeId: string; primary: string; secondary: string }[];

  constructor(
    memberLotteryBgms: string[],
    prizeLotteryMusics: {
      prizeId: string;
      primary: string;
      secondary: string;
    }[],
    variableTiming: number,
    prizeAnimations: { prizeId: string; primary: string; secondary: string }[]
  ) {
    this.memberLotteryBgms = memberLotteryBgms;
    this.prizeLotteryMusics = prizeLotteryMusics;
    this.variableTiming = variableTiming;
    this.prizeAnimations = prizeAnimations;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("memberLotteryBgms", JSON.stringify(this.memberLotteryBgms));
    records.set("prizeLotteryMusics", JSON.stringify(this.prizeLotteryMusics));
    records.set("variableTiming", this.variableTiming.toString());
    records.set("prizeAnimations", JSON.stringify(this.prizeAnimations));
    return records;
  }

  static fromRecords(records: Map<string, string>): MainScreenSetting {
    const memberLotteryBgms = JSON.parse(
      records.get("memberLotteryBgms") || "[]"
    );
    const prizeLotteryMusics = JSON.parse(
      records.get("prizeLotteryMusics") || "[]"
    );
    const variableTiming = parseInt(records.get("variableTiming") || "1");
    const prizeAnimations = JSON.parse(records.get("prizeAnimations") || "[]");
    return new MainScreenSetting(
      memberLotteryBgms,
      prizeLotteryMusics,
      variableTiming,
      prizeAnimations
    );
  }
}
