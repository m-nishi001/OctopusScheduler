export type ScreenType = 'home' | 'opening' | 'description' | 'demo' | 'main' | 'result' | 'admin';

export interface AnimationSettings {
  type: 'fade' | 'zoom' | 'scroll' | 'slide' | 'particle' | 'custom';
  duration?: number;
  delay?: number;
  params?: Record<string, any>;
}

export type ScreenElementType = 'text' | 'image' | 'video' | 'button' | 'progress' | 'list' | 'modal' | 'bgm';

export interface ScreenElement {
  id: string;
  type: ScreenElementType;
  content?: string;
  assetId?: string;
  value?: string;
  style?: string;
  animation?: AnimationSettings;
}

export interface ScreenConfig {
  type: ScreenType;
  bgmAssetId?: string;
  seAssetIds?: string[];
  backgroundStyle: string;
  elements: ScreenElement[];
  animationSettings?: AnimationSettings;
}
