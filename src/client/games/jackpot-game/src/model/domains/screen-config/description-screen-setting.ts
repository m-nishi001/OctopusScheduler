import type { IScreenSetting, ScreenType } from "./i-screen-setting";

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

export class DescriptionScreenSetting implements IScreenSetting {
  type: ScreenType = "description";
  descriptionBgm: string;
  screenElements: ScreenElement[];

  constructor(descriptionBgm: string, screenElements: ScreenElement[]) {
    this.descriptionBgm = descriptionBgm;
    this.screenElements = screenElements;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("descriptionBgm", this.descriptionBgm);
    records.set("screenElements", JSON.stringify(this.screenElements));
    return records;
  }

  static fromRecords(records: Map<string, string>): DescriptionScreenSetting {
    return new DescriptionScreenSetting(
      records.get("descriptionBgm") || "",
      JSON.parse(records.get("screenElements") || "[]")
    );
  }
}
