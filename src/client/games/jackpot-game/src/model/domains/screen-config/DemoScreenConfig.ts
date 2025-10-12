import type { IScreenConfig, ScreenType } from "./IScreenConfig";

export class DemoScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "demo";
  demoBgm: string;
  demoSe1: string;
  demoSe2: string;

  constructor(demoBgm: string, demoSe1: string, demoSe2: string, id?: string) {
    this.id = id || this.generateUuid();
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
