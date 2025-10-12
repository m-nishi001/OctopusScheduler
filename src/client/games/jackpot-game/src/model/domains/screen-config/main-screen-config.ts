import type { IScreenConfig, ScreenType } from "./i-screen-config";

export class MainScreenConfig implements IScreenConfig {
  type: ScreenType = "main";
  mainBgm: string;
  mainSe1: string;
  mainSe2: string;

  constructor(mainBgm: string, mainSe1: string, mainSe2: string) {
    this.mainBgm = mainBgm;
    this.mainSe1 = mainSe1;
    this.mainSe2 = mainSe2;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("mainBgm", this.mainBgm);
    records.set("mainSe1", this.mainSe1);
    records.set("mainSe2", this.mainSe2);
    return records;
  }

  static fromRecords(records: Map<string, string>): MainScreenConfig {
    return new MainScreenConfig(
      records.get("mainBgm") || "",
      records.get("mainSe1") || "",
      records.get("mainSe2") || ""
    );
  }
}
