import type { BrowserContext, Page } from "@playwright/test";

/**
 * 音の再生状態を、仕組み(HTMLの `<audio>` / `new Audio` / Web Audio)によらず同じ形で取り出す記録器。
 * 「音の再生の統一」(work/audio-unify)の前後で、画面ごとの音の動きが変わっていないことを機械で確かめるために使う。
 * ページを開く前に `installSoundTrace` を呼ぶ。
 *
 * 記録するもの:
 *   - HTMLMediaElement: play / pause / volume / ended
 *   - AudioBufferSourceNode: start / stop(曲の長さ `duration` で、どの曲かを見分ける)
 *   - GainNode の音量予約: setValueAtTime / linearRampToValueAtTime(フェードの確認用)
 * 取り出すもの: `soundTrace`(イベントの履歴)、`activeSounds`(いま鳴っているもの)。
 */

export type SoundEvent = {
  t: number;
  /** media: `<audio>`・`new Audio`、source: Web Audio のソース、gain: 音量の予約 */
  kind: "media" | "source" | "gain";
  e: string;
  /** 要素・ソースの連番(同じ番号は同じ再生) */
  id: number;
  loop?: boolean;
  /** media は音量、gain は予約した値 */
  v?: number;
  /** source: 曲の長さ(秒、小数2桁)。media: 読み込み済みなら曲の長さ */
  duration?: number;
  /** gain: 予約の時刻(AudioContext の秒) */
  at?: number;
};

export type ActiveSound = {
  kind: "media" | "source";
  id: number;
  loop: boolean;
  duration: number;
  /** media のみ */
  volume?: number;
  currentTime?: number;
  muted?: boolean;
};

type Win = Window & { __soundTrace?: { log: SoundEvent[]; active: () => ActiveSound[] } };

export async function installSoundTrace(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const log: SoundEvent[] = [];
    const ids = new WeakMap<object, number>();
    let count = 0;
    const idOf = (o: object) => {
      if (!ids.has(o)) ids.set(o, ++count);
      return ids.get(o)!;
    };
    const round = (n: number) => Math.round(n * 100) / 100;
    const mediaSeen = new Set<HTMLMediaElement>();
    const sources = new Map<object, { loop: boolean; duration: number }>();

    const mp = HTMLMediaElement.prototype;
    const play = mp.play;
    mp.play = function (this: HTMLMediaElement) {
      mediaSeen.add(this);
      log.push({ t: performance.now(), kind: "media", e: "play", id: idOf(this), loop: this.loop, duration: round(this.duration || 0) });
      return play.call(this);
    };
    const pause = mp.pause;
    mp.pause = function (this: HTMLMediaElement) {
      log.push({ t: performance.now(), kind: "media", e: "pause", id: idOf(this), loop: this.loop });
      return pause.call(this);
    };
    const volume = Object.getOwnPropertyDescriptor(mp, "volume")!;
    Object.defineProperty(mp, "volume", {
      configurable: true,
      get: volume.get,
      set(this: HTMLMediaElement, v: number) {
        log.push({ t: performance.now(), kind: "media", e: "volume", id: idOf(this), v });
        volume.set!.call(this, v);
      },
    });

    const sp = (window as unknown as { AudioBufferSourceNode?: { prototype: AudioBufferSourceNode } }).AudioBufferSourceNode?.prototype;
    if (sp) {
      const start = sp.start;
      const stop = sp.stop;
      sp.start = function (this: AudioBufferSourceNode, ...args: [number?, number?, number?]) {
        const info = { loop: this.loop, duration: round(this.buffer?.duration ?? 0) };
        sources.set(this, info);
        log.push({ t: performance.now(), kind: "source", e: "start", id: idOf(this), loop: info.loop, duration: info.duration });
        this.addEventListener("ended", () => {
          if (sources.delete(this)) log.push({ t: performance.now(), kind: "source", e: "ended", id: idOf(this) });
        });
        return start.apply(this, args);
      };
      sp.stop = function (this: AudioBufferSourceNode, ...args: [number?]) {
        if (sources.delete(this)) log.push({ t: performance.now(), kind: "source", e: "stop", id: idOf(this) });
        return stop.apply(this, args);
      };
    }

    const ap = (window as unknown as { AudioParam?: { prototype: AudioParam } }).AudioParam?.prototype;
    if (ap) {
      for (const name of ["setValueAtTime", "linearRampToValueAtTime"] as const) {
        const original = ap[name];
        ap[name] = function (this: AudioParam, value: number, at: number) {
          log.push({ t: performance.now(), kind: "gain", e: name === "setValueAtTime" ? "set" : "ramp", id: idOf(this), v: round(value * 1000) / 1000, at: round(at) });
          return original.call(this, value, at);
        };
      }
    }

    (window as Win).__soundTrace = {
      log,
      active: () => [
        ...[...mediaSeen]
          .filter((el) => !el.paused && !el.ended)
          .map((el) => ({ kind: "media" as const, id: idOf(el), loop: el.loop, duration: round(el.duration || 0), volume: el.volume, currentTime: el.currentTime, muted: el.muted })),
        ...[...sources].map(([node, info]) => ({ kind: "source" as const, id: idOf(node), loop: info.loop, duration: info.duration })),
      ],
    };
  });
}

/** 記録したイベントの履歴。 */
export const soundTrace = (page: Page): Promise<SoundEvent[]> => page.evaluate(() => (window as unknown as Win).__soundTrace!.log.slice());

/** いま鳴っているもの(止まっていないもの)。 */
export const activeSounds = (page: Page): Promise<ActiveSound[]> => page.evaluate(() => (window as unknown as Win).__soundTrace!.active());

/** 履歴のうち、指定した種類(media / source)の play・start だけを、曲の長さ・ループの有無・順番で取り出す。 */
export const starts = (log: SoundEvent[], kind: "media" | "source") => log.filter((x) => x.kind === kind && (x.e === "play" || x.e === "start"));

/** 履歴のうち、仕組み(media / source)を問わず、鳴らし始めたものだけ。 */
export const allStarts = (log: SoundEvent[]) => log.filter((x) => (x.kind === "media" && x.e === "play") || (x.kind === "source" && x.e === "start"));
