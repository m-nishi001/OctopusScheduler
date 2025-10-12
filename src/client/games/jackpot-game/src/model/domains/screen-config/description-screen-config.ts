import type { IScreenConfig, ScreenType } from "./i-screen-config";

export type ScreenElementType =
  | "text"
  | "image"
  | "video"
  | "button"
  | "progress"
  | "list"
  | "modal"
  | "bgm"
  | "html";

export interface ScreenElement {
  id: string;
  type: ScreenElementType;
  content?: string;
  assetId?: string;
  assetUrl?: string;
  value?: string; // ScreenContentのvalueを統合
  style?: string;
  animation?: AnimationSettings;
}

export interface AnimationSettings {
  type: "fade" | "zoom" | "scroll" | "slide" | "particle" | "custom";
  duration?: number;
  delay?: number;
  params?: Record<string, any>;
  scrollDirection?: "up" | "down" | "left" | "right";
}

export class DescriptionScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "description";
  descriptionBgm: string;
  screenElements: ScreenElement[];

  constructor(
    descriptionBgm: string,
    screenElements: ScreenElement[],
    id?: string
  ) {
    this.id = id || this.generateUuid();
    this.descriptionBgm = descriptionBgm;
    this.screenElements = screenElements;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("descriptionBgm", this.descriptionBgm);
    records.set("screenElements", JSON.stringify(this.screenElements));
    return records;
  }

  static fromRecords(
    id: string,
    records: Map<string, string>
  ): DescriptionScreenConfig {
    return new DescriptionScreenConfig(
      records.get("descriptionBgm") || "",
      JSON.parse(records.get("screenElements") || "[]"),
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
