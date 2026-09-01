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

export class OpeningScreenSetting {
  readonly type: "opening" = "opening";
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
    records.set("bgmAssetId", this.bgmAssetId);
    this.contents.forEach((content, index) => {
      records.set(`contents_${index}`, JSON.stringify(content));
    });
    return records;
  }

  static fromRecords(records: Map<string, string>): OpeningScreenSetting {
    const bgmAssetId = records.get("bgmAssetId") || "";
    const bgmMode: "select" | "upload" = bgmAssetId ? "select" : "select";
    const contents: OpeningContent[] = [];
    const contentKeys: string[] = [];
    for (const key of records.keys()) {
      if (key.startsWith("contents_")) {
        contentKeys.push(key);
      }
    }
    contentKeys.sort((a, b) => {
      const aIndex = parseInt(a.split("_")[1]);
      const bIndex = parseInt(b.split("_")[1]);
      return aIndex - bIndex;
    });
    for (const key of contentKeys) {
      const value = records.get(key)!;
      if (typeof value === "string") {
        contents.push(JSON.parse(value));
      } else {
        contents.push(value as OpeningContent);
      }
    }
    return new OpeningScreenSetting(bgmMode, bgmAssetId, contents);
  }
}
