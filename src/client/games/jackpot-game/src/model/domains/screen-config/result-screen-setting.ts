export class ResultScreenSetting {
  readonly type: "result" = "result";
  resultBgm: string;
  resultSe1: string;
  resultSe2: string;

  constructor(resultBgm: string, resultSe1: string, resultSe2: string) {
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

  static fromRecords(records: Map<string, string>): ResultScreenSetting {
    return new ResultScreenSetting(
      records.get("resultBgm") || "",
      records.get("resultSe1") || "",
      records.get("resultSe2") || ""
    );
  }
}
