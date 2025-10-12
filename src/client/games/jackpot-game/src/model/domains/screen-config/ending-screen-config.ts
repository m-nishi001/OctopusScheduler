import type { IScreenConfig, ScreenType } from "./i-screen-config";

export class EndingScreenConfig implements IScreenConfig {
  type: ScreenType = "ending";
  endingBgm: string;
  endingSe1: string;
  endingSe2: string;

  constructor(endingBgm: string, endingSe1: string, endingSe2: string) {
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

  static fromRecords(records: Map<string, string>): EndingScreenConfig {
    return new EndingScreenConfig(
      records.get("endingBgm") || "",
      records.get("endingSe1") || "",
      records.get("endingSe2") || ""
    );
  }
}
