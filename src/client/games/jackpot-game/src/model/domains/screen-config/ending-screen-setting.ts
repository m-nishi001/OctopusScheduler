import type { IScreenSetting, ScreenType } from "./i-screen-setting";

export class EndingScreenSetting implements IScreenSetting {
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

  static fromRecords(records: Map<string, string>): EndingScreenSetting {
    return new EndingScreenSetting(
      records.get("endingBgm") || "",
      records.get("endingSe1") || "",
      records.get("endingSe2") || ""
    );
  }
}
