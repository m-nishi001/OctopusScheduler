import type { IScreenSetting, ScreenType } from "./i-screen-setting";

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

export class OpeningScreenSetting implements IScreenSetting {
  type: ScreenType = "opening";
  bgmMode: "select" | "upload";
  bgmAssetId: string;
  contents: OpeningContent[];

  constructor(
    bgmMode: "select" | "upload" = "select",
    bgmAssetId: string = "",
    contents: OpeningContent[] = []
  ) {
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

  static fromRecords(records: Map<string, string>): OpeningScreenSetting {
    return new OpeningScreenSetting(
      (records.get("bgmMode") as "select" | "upload") || "select",
      records.get("bgmAssetId") || "",
      JSON.parse(records.get("contents") || "[]")
    );
  }
}
