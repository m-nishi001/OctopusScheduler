import type { IScreenConfig, ScreenType } from "./i-screen-config";

export class HomeScreenConfig implements IScreenConfig {
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

  static fromRecords(records: Map<string, string>): HomeScreenConfig {
    return new HomeScreenConfig(
      records.get("homeBgm") || "",
      records.get("buttonClikingSE") || "",
      records.get("onCompletedLoadingSE") || ""
    );
  }
}
