/**
 * オープニング・エンディングの動き(タイムラインの計算)。DOM には触れない純粋関数。
 * 画面は、項目の大きさを測って {@link buildTimeline} に渡し、再生中は {@link sampleTimeline} で「いまの位置と透明度」を得て当てるだけ。
 *
 * 座標は、項目が画面の中央に静止しているときを 0 とする(y は下向きが正。上へ送ると負になる)。
 */
import type { SequenceEffect, SequenceKind } from "./screen-config/sequence-setting";

export interface Measure {
  /** 項目を出す領域(画面)の高さ(px)。 */
  viewportHeight: number;
  /** 項目全体の高さ(px)。テキストは折り返しを含めた全体。 */
  contentHeight: number;
  /** テキストの1行の高さ(px)。 */
  lineHeight: number;
}

/** 時刻 t(秒)の、項目の縦のずれ(px)と透明度(0〜1)。 */
export interface Keyframe {
  t: number;
  y: number;
  opacity: number;
}

export interface Timeline {
  /** 項目を出している長さ(秒)。 */
  duration: number;
  /** 時刻順。隣り合うキーフレームの間は直線で結ぶ。 */
  keyframes: Keyframe[];
  /** 行送りのとき、ページ(1回に出す行のかたまり)の数。それ以外は 1。 */
  pages: number;
}

/** 行送りで、ページを送る動きの長さ(秒)。表示する秒数(`seconds`)の中に収める。 */
export const PAGE_SLIDE_SEC = 0.5;
/** フェードの出入りの長さの上限(秒)。 */
export const FADE_SEC = 0.8;

export interface TimelineItem {
  kind: SequenceKind;
  effect: SequenceEffect;
  seconds: number;
  /** 行送りの、1回に送る行数。 */
  lines: number;
}

/** 折り返しを含めた行数(1以上)。 */
export function countLines(contentHeight: number, lineHeight: number): number {
  if (!(lineHeight > 0) || !(contentHeight > 0)) return 1;
  return Math.max(1, Math.round(contentHeight / lineHeight));
}

/** 行送りの、ページ数。 */
export function pageCount(totalLines: number, linesPerPage: number): number {
  return Math.max(1, Math.ceil(totalLines / Math.max(1, linesPerPage)));
}

/** 行送りで、1ページに出す窓の高さ(px)。最後のページの行が足りなくても、窓の高さは同じにして位置を揃える。 */
export function pageWindowHeight(linesPerPage: number, lineHeight: number): number {
  return Math.max(1, linesPerPage) * lineHeight;
}

/** 項目の動きを作る。秒数が 0 以下なら 0.1 秒に直す(動かない項目で固まらないように)。 */
export function buildTimeline(item: TimelineItem, m: Measure): Timeline {
  const seconds = item.seconds > 0 ? item.seconds : 0.1;
  const still = (): Timeline => ({ duration: seconds, pages: 1, keyframes: [{ t: 0, y: 0, opacity: 1 }, { t: seconds, y: 0, opacity: 1 }] });
  switch (item.effect) {
    case "静止":
      return still();
    case "フェード": {
      const edge = Math.min(FADE_SEC, seconds / 3);
      return {
        duration: seconds,
        pages: 1,
        keyframes: [
          { t: 0, y: 0, opacity: 0 },
          { t: edge, y: 0, opacity: 1 },
          { t: seconds - edge, y: 0, opacity: 1 },
          { t: seconds, y: 0, opacity: 0 },
        ],
      };
    }
    case "流れる": {
      // 項目の上端が画面の下端に隠れた位置から、下端が画面の上端の外に出る位置まで、一定の速さで
      const travel = m.viewportHeight / 2 + m.contentHeight / 2;
      return { duration: seconds, pages: 1, keyframes: [{ t: 0, y: travel, opacity: 1 }, { t: seconds, y: -travel, opacity: 1 }] };
    }
    case "行送り": {
      if (item.kind !== "テキスト") return still();
      const total = countLines(m.contentHeight, m.lineHeight);
      const pages = pageCount(total, item.lines);
      const step = pageWindowHeight(item.lines, m.lineHeight);
      const slide = Math.min(PAGE_SLIDE_SEC, seconds / 2);
      const keyframes: Keyframe[] = [{ t: 0, y: 0, opacity: 1 }];
      for (let k = 1; k < pages; k++) {
        // ページ k-1 を seconds 秒見せてから、slide 秒かけて次へ送る
        const held = k * seconds + (k - 1) * slide;
        keyframes.push({ t: held, y: -(k - 1) * step, opacity: 1 }, { t: held + slide, y: -k * step, opacity: 1 });
      }
      const duration = pages * seconds + (pages > 1 ? slide * (pages - 1) : 0);
      keyframes.push({ t: duration, y: pages > 1 ? -(pages - 1) * step : 0, opacity: 1 });
      return { duration, pages, keyframes };
    }
  }
}

/** 時刻 t(秒)の位置と透明度。範囲の外は両端の値。 */
export function sampleTimeline(timeline: Timeline, t: number): { y: number; opacity: number } {
  const ks = timeline.keyframes;
  if (t <= ks[0].t) return { y: ks[0].y, opacity: ks[0].opacity };
  const last = ks[ks.length - 1];
  if (t >= last.t) return { y: last.y, opacity: last.opacity };
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i].t) {
      const a = ks[i - 1];
      const b = ks[i];
      const span = b.t - a.t;
      const f = span > 0 ? (t - a.t) / span : 1;
      return { y: a.y + (b.y - a.y) * f, opacity: a.opacity + (b.opacity - a.opacity) * f };
    }
  }
  return { y: last.y, opacity: last.opacity };
}

/** 行送りで、時刻 t に見えているページ(0始まり)。送っている途中は、先のページ。 */
export function pageAt(timeline: Timeline, t: number): number {
  if (timeline.pages <= 1) return 0;
  const step = Math.abs(timeline.keyframes[timeline.keyframes.length - 1].y) / (timeline.pages - 1);
  if (step === 0) return 0;
  const { y } = sampleTimeline(timeline, t);
  return Math.min(timeline.pages - 1, Math.round(Math.abs(y) / step));
}
