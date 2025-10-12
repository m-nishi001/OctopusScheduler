import type { IScreenConfig, ScreenType } from "./IScreenConfig";

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
    this.id = id || Utilities.getUuid();
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
}
