/** 結果画面の設定(BGM)。 */
export class ResultScreenSetting {
  readonly type = "result" as const;
  resultBgm: string;

  constructor(resultBgm: string) {
    this.resultBgm = resultBgm;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("resultBgm", this.resultBgm);
    return records;
  }

  static fromRecords(records: Map<string, string>): ResultScreenSetting {
    return new ResultScreenSetting(records.get("resultBgm") || "");
  }
}
