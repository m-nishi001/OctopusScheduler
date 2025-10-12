import type { IScreenConfig, ScreenType } from "./i-screen-config";

export interface OpeningContent {
  type: "text" | "image" | "html";
  text?: string;
  content?: string;
  imageMode?: "select" | "upload";
  assetId?: string;
  effect: "scroll" | "fade" | "static";
  duration: number;
  seMode?: "select" | "upload";
  seAssetId?: string;
}

export class OpeningScreenConfig implements IScreenConfig {
  id: string;
  type: ScreenType = "opening";
  bgmMode: "select" | "upload";
  bgmAssetId: string;
  contents: OpeningContent[];

  constructor(
    bgmMode: "select" | "upload" = "select",
    bgmAssetId: string = "",
    contents: OpeningContent[] = [],
    id?: string
  ) {
    this.id = id || this.generateUuid();
    this.bgmMode = bgmMode;
    this.bgmAssetId = bgmAssetId;
    this.contents = contents;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("bgmMode", this.bgmMode);
    records.set("bgmAssetId", this.bgmAssetId);
    records.set("contents", JSON.stringify(this.contents));
    return records;
  }

  static fromRecords(
    id: string,
    records: Map<string, string>
  ): OpeningScreenConfig {
    return new OpeningScreenConfig(
      (records.get("bgmMode") as "select" | "upload") || "select",
      records.get("bgmAssetId") || "",
      JSON.parse(records.get("contents") || "[]"),
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
