import type { IScreenConfig, ScreenType } from "./IScreenConfig";

export class DescriptionScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "description";
  descriptionBgm: string;
  descriptionSe1: string;
  descriptionSe2: string;

  constructor(
    descriptionBgm: string,
    descriptionSe1: string,
    descriptionSe2: string,
    id?: string
  ) {
    this.id = id || this.generateUuid();
    this.descriptionBgm = descriptionBgm;
    this.descriptionSe1 = descriptionSe1;
    this.descriptionSe2 = descriptionSe2;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("descriptionBgm", this.descriptionBgm);
    records.set("descriptionSe1", this.descriptionSe1);
    records.set("descriptionSe2", this.descriptionSe2);
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
