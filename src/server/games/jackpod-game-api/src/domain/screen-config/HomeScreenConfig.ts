import type { IScreenConfig, ScreenType } from "./IScreenConfig";

export class HomeScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "home";
  homeBgm: string;
  buttonClikingSE: string;
  onCompletedLoadingSE: string;

  constructor(
    homeBgm: string,
    buttonClikingSE: string,
    onCompletedLoadingSE: string,
    id?: string
  ) {
    this.id = id || Utilities.getUuid();
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
}
