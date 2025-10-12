import type { IScreenConfig, ScreenType } from "./IScreenConfig";

export class ResultScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "result";
  resultBgm: string;
  resultSe1: string;
  resultSe2: string;

  constructor(
    resultBgm: string,
    resultSe1: string,
    resultSe2: string,
    id?: string
  ) {
    this.id = id || Utilities.getUuid();
    this.resultBgm = resultBgm;
    this.resultSe1 = resultSe1;
    this.resultSe2 = resultSe2;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("resultBgm", this.resultBgm);
    records.set("resultSe1", this.resultSe1);
    records.set("resultSe2", this.resultSe2);
    return records;
  }
}
