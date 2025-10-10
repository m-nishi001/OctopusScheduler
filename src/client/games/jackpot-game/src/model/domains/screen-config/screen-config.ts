export type ScreenType =
  | "home"
  | "opening"
  | "description"
  | "demo"
  | "main"
  | "result"
  | "admin";

export class ScreenConfig {
  id: string;
  type: ScreenType;
  bgmAssetId?: string;
  seAssetIds?: string[];
  backgroundStyle: string;
  elements: ScreenElement[];
  animationSettings?: AnimationSettings;

  constructor(
    type: ScreenType,
    backgroundStyle: string,
    elements: ScreenElement[],
    bgmAssetId?: string,
    seAssetIds?: string[],
    animationSettings?: AnimationSettings,
    id?: string
  ) {
    this.id = id || this.generateUuid();
    this.type = type;
    this.bgmAssetId = bgmAssetId;
    this.seAssetIds = seAssetIds;
    this.backgroundStyle = backgroundStyle;
    this.elements = elements.map((element) => ({
      ...element,
      id: element.id || this.generateUuid(),
    }));
    this.animationSettings = animationSettings;
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
