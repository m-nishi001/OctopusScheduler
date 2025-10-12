import type { IScreenConfig, ScreenType } from "./IScreenConfig";

export class MainScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "main";
  mainBgm: string;
  mainSe1: string;
  mainSe2: string;

  constructor(mainBgm: string, mainSe1: string, mainSe2: string, id?: string) {
    this.id = id || Utilities.getUuid();
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
}
