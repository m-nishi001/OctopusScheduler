import type { IScreenConfig, ScreenType } from "./IScreenConfig";

export class DemoScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "demo";
  demoBgm: string;
  demoSe1: string;
  demoSe2: string;

  constructor(demoBgm: string, demoSe1: string, demoSe2: string, id?: string) {
    this.id = id || Utilities.getUuid();
    this.demoBgm = demoBgm;
    this.demoSe1 = demoSe1;
    this.demoSe2 = demoSe2;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("demoBgm", this.demoBgm);
    records.set("demoSe1", this.demoSe1);
    records.set("demoSe2", this.demoSe2);
    return records;
  }
}
