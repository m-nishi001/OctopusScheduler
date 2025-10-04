import type {
  ScreenType,
  AnimationSettings,
  ScreenElementType,
} from "../../domains/screen-config/screen-config";

export interface ScreenElementDto {
  id: string;
  type: ScreenElementType;
  content?: string;
  assetId?: string;
  assetUrl?: string;
  value?: string;
  style?: string;
  animation?: AnimationSettings;
}

export interface ScreenConfigDto {
  id?: string;
  type: ScreenType;
  bgmAssetId?: string;
  bgmAssetUrl?: string;
  displayMode?: "list" | "html";
  seAssetIds?: string[];
  seAssetUrls?: string[];
  backgroundStyle: string;
  elements: ScreenElementDto[];
  animationSettings?: AnimationSettings;
}
