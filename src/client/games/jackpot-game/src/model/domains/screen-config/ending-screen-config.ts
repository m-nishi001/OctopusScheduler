import type { IScreenConfig, ScreenType } from "./i-screen-config";

export class EndingScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "admin";
  endingBgm: string;
  endingSe1: string;
  endingSe2: string;

  constructor(
    endingBgm: string,
    endingSe1: string,
    endingSe2: string,
    id?: string
  ) {
    this.id = id || this.generateUuid();
    this.endingBgm = endingBgm;
    this.endingSe1 = endingSe1;
    this.endingSe2 = endingSe2;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("endingBgm", this.endingBgm);
    records.set("endingSe1", this.endingSe1);
    records.set("endingSe2", this.endingSe2);
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
