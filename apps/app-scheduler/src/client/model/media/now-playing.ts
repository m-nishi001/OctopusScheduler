import type { CatalogItem } from "./media-catalog";
import { ASSET_ID_PATTERN } from "./media-command";
import { parseScreenSpec, type ScreenSpec } from "./screen-spec";

/**
 * 「いま流れている・映っているもの」。真実はホストの実際の出力で、管理端末はそれを表示するだけにする。
 *   - 音: ホストが `playback` に公開する(`AudioControl` が鳴らしている曲)
 *   - 画面: ホストが遷移のたびに公開する `session.path` から導く(新しい状態は持たない)
 */
export const PLAYBACK_NS = "playback";
const SESSION_NS = "session";

/** 鳴っている曲 1 件。 */
export interface NowPlayingAudio {
  assetId: string;
  loop: boolean;
}

/** ホストが `playback` に公開する状態。 */
export interface PlaybackSlice {
  audio: NowPlayingAudio[];
}

/**
 * 公開する曲の最大件数と、この名前空間(`playback`)に、ルーム状態の 6000 バイト(`MAX_STATE_BYTES`)のうち割り当てる大きさ。
 * 1 件は最大でも約 92 バイト(素材 ID は 64 文字まで。8 件で最大 739)。素材の一覧 `media`(1800)と合わせて 2550 バイトに抑え、
 * 残りの 3450 バイトを、画面(`session`)・イベント・クイズ(最大約 2700)・ジャックポット・結果に残す。
 */
export const MAX_PLAYBACK_AUDIO = 8;
export const PLAYBACK_SLICE_BUDGET_BYTES = 750;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 鳴っている曲の一覧から、公開する状態を作る。件数は `MAX_PLAYBACK_AUDIO` まで(古い順に残す)。 */
export function buildPlaybackSlice(audio: readonly NowPlayingAudio[]): PlaybackSlice {
  return { audio: audio.slice(0, MAX_PLAYBACK_AUDIO).map(({ assetId, loop }) => ({ assetId, loop })) };
}

/** 信頼境界。ルーム状態の `playback` を検証して読む。形が違えば null(ホストが古い・まだ公開していない)。不正な項目と重複は捨てる。 */
export function parsePlaybackSlice(value: unknown): PlaybackSlice | null {
  if (!isRecord(value) || !Array.isArray(value.audio)) return null;
  const seen = new Set<string>();
  const audio: NowPlayingAudio[] = [];
  for (const item of value.audio) {
    if (!isRecord(item) || typeof item.assetId !== "string" || !ASSET_ID_PATTERN.test(item.assetId)) continue;
    if (typeof item.loop !== "boolean" || seen.has(item.assetId)) continue;
    seen.add(item.assetId);
    audio.push({ assetId: item.assetId, loop: item.loop });
    if (audio.length >= MAX_PLAYBACK_AUDIO) break;
  }
  return { audio };
}

/** ルーム状態の `data` から、`playback` を読む。 */
export function readPlaybackSlice(data: Record<string, unknown> | null | undefined): PlaybackSlice | null {
  return parsePlaybackSlice(data?.[PLAYBACK_NS]);
}

/** ルーム状態の `data` から、ホストの「いまの画面のパス」(`session.path`)を読む。 */
export function readSessionPath(data: Record<string, unknown> | null | undefined): string | null {
  const session = data?.[SESSION_NS];
  return isRecord(session) && typeof session.path === "string" ? session.path : null;
}

/**
 * スクリーンの画面のパス。ルーター(`ui/router/index.ts`)の、`/execute` の子ルート
 * `show-image/:id` `show-video/:id` `show-slideshow/:data` と対で、`now-playing.spec.ts` が実際のルートで確かめる。
 * `:data` は、スライドショーの指定(JSON)を URL エンコードしたもの。
 */
const SCREEN_PATH = /^\/execute\/(show-image|show-video|show-slideshow)\/([^/?#]+)(?:[?#].*)?$/;

/** ホストの画面のパス(`session.path`)から、スクリーンに映っているものを導く。スクリーンの画面でなければ null。 */
export function screenFromPath(path: string | null | undefined): ScreenSpec | null {
  const match = typeof path === "string" ? SCREEN_PATH.exec(path) : null;
  if (!match) return null;
  let param: string;
  try {
    param = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (match[1] === "show-slideshow") {
    try {
      const spec = parseScreenSpec(JSON.parse(param));
      return spec?.kind === "slideshow" ? spec : null;
    } catch {
      return null;
    }
  }
  return parseScreenSpec({ kind: match[1] === "show-image" ? "image" : "video", id: param });
}

/** 一覧に無い素材(削除済み・アップロード前で一覧にまだ出ていない)の表示名。 */
export const UNKNOWN_ASSET_NAME = "(名前の分からない素材)";

export interface NowPlayingAudioRow {
  assetId: string;
  name: string;
  loop: boolean;
}
export interface NowPlayingScreenRow {
  kind: ScreenSpec["kind"];
  /** 種類の表示名(画像・動画・スライドショー)。 */
  kindLabel: string;
  name: string;
}
export interface NowPlayingView {
  audio: NowPlayingAudioRow[];
  screen: NowPlayingScreenRow | null;
}

const KIND_LABELS: Record<ScreenSpec["kind"], string> = { image: "画像", video: "動画", slideshow: "スライドショー" };

/** 公開された状態と、素材の一覧から、表示用の行を作る。名前が見つからない素材は `UNKNOWN_ASSET_NAME`。 */
export function describeNowPlaying(slice: PlaybackSlice | null, screen: ScreenSpec | null, catalog: readonly CatalogItem[]): NowPlayingView {
  const nameOf = (id: string) => catalog.find((item) => item.id === id)?.name ?? UNKNOWN_ASSET_NAME;
  return {
    audio: (slice?.audio ?? []).map((a) => ({ assetId: a.assetId, name: nameOf(a.assetId), loop: a.loop })),
    screen: screen
      ? { kind: screen.kind, kindLabel: KIND_LABELS[screen.kind], name: screen.kind === "slideshow" ? screen.folder : nameOf(screen.id) }
      : null,
  };
}
