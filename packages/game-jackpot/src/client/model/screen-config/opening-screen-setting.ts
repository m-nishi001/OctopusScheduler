export interface OpeningContent {
  type: "text" | "image" | "html";
  text?: string;
  content?: string;
  /** 画像の素材の名前。 */
  media?: string;
  effect: "scroll" | "fade" | "static";
  duration: number;
  /** 効果音の素材の名前。 */
  se?: string;
  /** 再生のとき、画像の素材から作る表示用の URL(保存しない)。 */
  assetUrl?: string;
}

/** オープニング画面の設定(BGM と、順に出すコンテンツ)。素材は名前で参照する。 */
export class OpeningScreenSetting {
  readonly type = "opening" as const;
  bgm: string;
  contents: OpeningContent[];

  constructor(bgm: string = "", contents: OpeningContent[] = []) {
    this.bgm = bgm;
    this.contents = contents;
  }
}
