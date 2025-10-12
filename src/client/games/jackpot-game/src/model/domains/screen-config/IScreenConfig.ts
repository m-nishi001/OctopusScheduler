export type ScreenType =
  | "home"
  | "opening"
  | "description"
  | "demo"
  | "main"
  | "result"
  | "admin";

export interface IScreenConfig {
  id: string;
  type: ScreenType;
  toRecords(): Map<string, string>;
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
