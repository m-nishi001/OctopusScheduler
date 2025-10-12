import type { IScreenSetting, ScreenType } from "./i-screen-setting";

export class HomeScreenSetting implements IScreenSetting {
  type: ScreenType = "home";
  homeBgm: string;
  buttonClikingSE: string;
  onCompletedLoadingSE: string;

  constructor(
    homeBgm: string,
    buttonClikingSE: string,
    onCompletedLoadingSE: string
  ) {
    this.homeBgm = homeBgm;
    this.buttonClikingSE = buttonClikingSE;
    this.onCompletedLoadingSE = onCompletedLoadingSE;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("homeBgm", this.homeBgm);
    records.set("buttonClikingSE", this.buttonClikingSE);
    records.set("onCompletedLoadingSE", this.onCompletedLoadingSE);
    return records;
  }

  static fromRecords(records: Map<string, string>): HomeScreenSetting {
    return new HomeScreenSetting(
      records.get("homeBgm") || "",
      records.get("buttonClikingSE") || "",
      records.get("onCompletedLoadingSE") || ""
    );
  }
}
