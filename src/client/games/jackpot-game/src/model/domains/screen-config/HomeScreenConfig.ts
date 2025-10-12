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
    this.id = id || this.generateUuid();
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

  private generateUuid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}
