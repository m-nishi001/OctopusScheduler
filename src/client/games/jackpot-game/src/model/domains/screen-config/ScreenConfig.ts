export type ScreenType = 'home' | 'opening' | 'description' | 'demo' | 'main' | 'result' | 'admin';

export interface AnimationSettings {
  type: 'fade' | 'zoom' | 'scroll' | 'slide' | 'particle' | 'custom';
  duration?: number;
  delay?: number;
  params?: Record<string, any>;
}

export interface ScreenElement {
  id: string;
  type: 'text' | 'image' | 'video' | 'button' | 'progress' | 'list' | 'modal';
  content?: string;
  assetId?: string;
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
