import type { IScreenConfig, ScreenType } from "./IScreenConfig";

export class OpeningScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "opening";
  openingBgm: string;
  openingSe1: string;
  openingSe2: string;

  constructor(
    openingBgm: string,
    openingSe1: string,
    openingSe2: string,
    id?: string
  ) {
    this.id = id || this.generateUuid();
    this.openingBgm = openingBgm;
    this.openingSe1 = openingSe1;
    this.openingSe2 = openingSe2;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("openingBgm", this.openingBgm);
    records.set("openingSe1", this.openingSe1);
    records.set("openingSe2", this.openingSe2);
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
