import type { IScreenConfig, ScreenType } from "./i-screen-config";

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
    this.id = id || this.generateUuid();
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

  static fromRecords(
    id: string,
    records: Map<string, string>
  ): ResultScreenConfig {
    return new ResultScreenConfig(
      records.get("resultBgm") || "",
      records.get("resultSe1") || "",
      records.get("resultSe2") || "",
      id
    );
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
