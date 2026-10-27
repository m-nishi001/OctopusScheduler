/**
 * スロットのリール1本ぶんの位置計算(描画から切り離した純粋関数)。
 *
 * 景品の並び(ループ)を輪のように扱う。位置は「上へ流れた距離(px)」で、輪の1周で元に戻る。
 * 描画は「ループ + 窓の高さ分」を並べて、窓がどの位置でも帯の内側に収まるようにする
 * (帯の末尾で位置を0に戻す瞬間も、窓の中身は同じ絵なので継ぎ目が見えない)。
 */

/** 窓に見えるマス数。 */
export const WINDOW_ROWS = 3;
/** 当たりの行(窓の上から数えた番号。真ん中の行)。止まったとき、止める景品はここに来る。 */
export const WIN_ROW = 1;
/** ループの最短の長さ。景品が少なくても、流れて見えるように繰り返して埋める。 */
export const MIN_LOOP_LENGTH = 10;

/** 0以上1未満の乱数を返す関数。テストでは決まった列を渡す。 */
export type Rng = () => number;

/** リールに並べる景品。止める場所を決めるのは id、見た目は name。 */
export interface ReelItem {
  id: string;
  name: string;
}

/** 0〜n-1 の整数を乱数から選ぶ(乱数が 1 を返しても範囲を越えない)。 */
function pick(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/**
 * 景品を最短の長さまで繰り返して埋める。足す景品は「その時点で一番少ない名前」から選ぶので、
 * 名前ごとの数が偏らない(同じ名前が多すぎると、隣り合わない並びが作れなくなるため)。
 * 名前が2種類のときは、交互に並べられるよう長さを偶数にする。
 */
export function fillLoop<T extends ReelItem>(items: readonly T[], minLength = MIN_LOOP_LENGTH): T[] {
  if (items.length === 0) return [];
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.name, [...(groups.get(item.name) ?? []), item]);
  let length = Math.max(minLength, items.length);
  if (groups.size === 2 && length % 2 === 1) length++;

  const filled = [...items];
  const counts = new Map([...groups].map(([name, g]) => [name, g.length]));
  const used = new Map([...groups].map(([name]) => [name, 0]));
  while (filled.length < length) {
    let name = "";
    let least = Infinity;
    for (const [n, c] of counts) {
      if (c < least) {
        least = c;
        name = n;
      }
    }
    const group = groups.get(name)!;
    const k = used.get(name)!;
    filled.push(group[k % group.length]);
    used.set(name, k + 1);
    counts.set(name, least + 1);
  }
  return filled;
}

/** 輪として見たとき、隣り合う(末尾と先頭も)景品が同じ名前の組の数。 */
export function adjacentSameNameCount(loop: readonly ReelItem[]): number {
  if (loop.length < 2) return 0;
  let n = 0;
  for (let i = 0; i < loop.length; i++) if (loop[i].name === loop[(i + 1) % loop.length].name) n++;
  return n;
}

/** 位置 p の前後の組で、同じ名前が隣り合っている数(入れ替えの前後で比べる用)。 */
function badPairsAround(loop: readonly ReelItem[], positions: readonly number[]): number {
  const n = loop.length;
  const pairs = new Set<number>();
  for (const p of positions) {
    pairs.add((p - 1 + n) % n); // (p-1, p)
    pairs.add(p); // (p, p+1)
  }
  let bad = 0;
  for (const i of pairs) if (loop[i].name === loop[(i + 1) % n].name) bad++;
  return bad;
}

/**
 * 同じ名前が隣り合わない輪にする(末尾と先頭の継ぎ目も含む)。
 * 1) 名前ごとに多い順にまとめ、偶数の位置 → 奇数の位置の順に詰める(同じ名前が隣り合わない並びが作れる条件なら、これで作れる)。
 * 2) 規則的に見えないよう、隣り合わない状態を保てる入れ替えだけを乱数で繰り返す。
 * 作れない(1つの名前が半数を超える・名前が1種類)ときは、できるだけ隣り合わない並びにとどめる。
 */
export function separateSameNames<T extends ReelItem>(loop: readonly T[], rng: Rng): T[] {
  const n = loop.length;
  if (n < 3) return [...loop];
  const groups = new Map<string, T[]>();
  for (const item of loop) groups.set(item.name, [...(groups.get(item.name) ?? []), item]);
  // 乱数で名前の順を混ぜてから、安定ソートで多い順にする(同じ数の名前の並びが毎回同じにならない)
  const names = [...groups.keys()];
  for (let i = names.length - 1; i > 0; i--) {
    const j = pick(rng, i + 1);
    [names[i], names[j]] = [names[j], names[i]];
  }
  names.sort((a, b) => groups.get(b)!.length - groups.get(a)!.length);
  const queue = names.flatMap((name) => groups.get(name)!);

  const out: T[] = new Array(n);
  let q = 0;
  for (let i = 0; i < n; i += 2) out[i] = queue[q++];
  for (let i = 1; i < n; i += 2) out[i] = queue[q++];

  for (let step = 0; step < n * 8; step++) {
    const a = pick(rng, n);
    const b = pick(rng, n);
    if (a === b || out[a].name === out[b].name) continue;
    const before = badPairsAround(out, [a, b]);
    [out[a], out[b]] = [out[b], out[a]];
    if (badPairsAround(out, [a, b]) > before) [out[a], out[b]] = [out[b], out[a]];
  }
  return out;
}

/**
 * リール1本ぶんのループ。景品を最短の長さまで埋め、乱数で並べ、同じ名前が隣り合わないようにする。
 * リールごとに別の乱数で呼べば、3本が違う並びになる。景品が無ければ空。
 */
export function buildReelLoop<T extends ReelItem>(items: readonly T[], rng: Rng, minLength = MIN_LOOP_LENGTH): T[] {
  return separateSameNames(fillLoop(items, minLength), rng);
}

/** ループ1周の高さ(px)。 */
export function cycleHeight(loopLength: number, itemHeight: number): number {
  return loopLength * itemHeight;
}

/** 位置を 0 以上 1周未満に収める(負や1周以上の値も正しく折り返す)。 */
export function wrapPosition(position: number, cycle: number): number {
  if (cycle <= 0) return 0;
  return ((position % cycle) + cycle) % cycle;
}

/** 1フレーム進める。速度は px/フレーム。 */
export function advancePosition(position: number, speed: number, cycle: number): number {
  return wrapPosition(position + speed, cycle);
}

/** 描画するマス数。ループ1周 + 窓の高さ分で、窓は常に帯の内側に収まる。 */
export function renderedCount(loopLength: number): number {
  return loopLength === 0 ? 0 : loopLength + WINDOW_ROWS;
}

/** 指定したマスを窓の一番上に合わせる位置。 */
export function positionForIndex(index: number, itemHeight: number, cycle: number): number {
  return wrapPosition(index * itemHeight, cycle);
}

/** 位置のとき、窓の下端が帯の末尾を越えないか(空白が映らないか)。 */
export function windowWithinStrip(position: number, loopLength: number, itemHeight: number): boolean {
  return position >= 0 && position + WINDOW_ROWS * itemHeight <= renderedCount(loopLength) * itemHeight;
}

/** 回転の速さ(px/フレーム)。マスの高さに比例し、リールごとに少しずつ違う。速くして、流れる景品を読み取れなくする。 */
export function spinSpeed(reelIndex: number, itemHeight: number): number {
  return itemHeight * (0.16 + reelIndex * 0.02);
}

/** 景品抽選が止まるまでの時間(停止ボタンから最後のリールが止まるまで)の既定(ms)。設定が無いときに使う。 */
export const DEFAULT_STOP_TOTAL_MS = 4000;

/** 各リールが減速を始める・止まる時刻(止め始めからの ms)。 */
export interface ReelStopTiming {
  startMs: number;
  endMs: number;
}

/** 左・中・右の減速の開始と終わりを、全体の長さ D に対する割合で決める。右のリールが一番長く、ゆっくり粘って止まる(リーチの見せ場)。 */
const STOP_FRACTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.35],
  [0.2, 0.65],
  [0.4, 1],
];

/**
 * 止め始めてから最後のリールが止まるまでを totalMs として、リールごとの減速の開始と終わりを返す。
 * どのリールも、自分の減速が始まるまでは全速で回り続ける。左 → 中 → 右の順に止まり、最後に止まるのは totalMs ちょうど。
 */
export function stopSchedule(totalMs: number): ReelStopTiming[] {
  return STOP_FRACTIONS.map(([start, end]) => ({ startMs: totalMs * start, endMs: totalMs * end }));
}

/** 止まった勢いで少し行き過ぎて戻る動き(跳ね返り)の長さ(ms)と、行き過ぎる大きさ(マスの高さに対する比)。 */
export const SETTLE_BOUNCE_MS = 250;
export const SETTLE_BOUNCE_RATIO = 0.12;

/**
 * 止まった瞬間からの経過時間に対する、行き過ぎの距離(px、進む向きが正)。
 * 0 から始まり、中ほどで最大(マスの高さ × SETTLE_BOUNCE_RATIO)になり、SETTLE_BOUNCE_MS で 0 に戻る(始まりと終わりでなめらか)。
 * 範囲外(止まる前・戻りきった後)は 0。
 */
export function settleOffset(elapsedMs: number, itemHeight: number): number {
  if (elapsedMs <= 0 || elapsedMs >= SETTLE_BOUNCE_MS) return 0;
  const u = elapsedMs / SETTLE_BOUNCE_MS;
  return itemHeight * SETTLE_BOUNCE_RATIO * Math.sin(Math.PI * u) ** 2;
}

/** 描画が1秒に進むフレーム数(速さを px/フレーム から px/秒 にする目安)。 */
const FRAMES_PER_SEC = 60;

/**
 * 減速して止める計画。`from` から `to` まで(`to` は折り返す前の値で、止める景品のマスが当たりの行に来る位置 + 整数周)、
 * 最初は回転と同じ速さで、だんだん遅くなって止まる(速さが途切れない滑らかな曲線)。
 */
export interface StopPlan {
  from: number;
  to: number;
  /** 動き始めの速さ(全体を平均した速さに対する倍率。3以下で、行き過ぎや逆戻りが無い)。 */
  slope: number;
  durationMs: number;
}

/**
 * 止める景品のマスが当たりの行(真ん中)に来る位置で止まる計画を立てる。回転の速さから滑らかに減速するのに必要な距離より先にある、最初のマスを選ぶ。
 * ループに止める景品が無ければ null。
 */
export function planStop(args: {
  loop: readonly ReelItem[];
  targetId: string;
  position: number;
  itemHeight: number;
  speedPerFrame: number;
  durationMs: number;
}): StopPlan | null {
  const { loop, targetId, itemHeight, speedPerFrame, durationMs } = args;
  const cycle = cycleHeight(loop.length, itemHeight);
  if (cycle <= 0) return null;
  const from = wrapPosition(args.position, cycle);
  const speed = speedPerFrame * FRAMES_PER_SEC; // px/秒
  const travel = (speed * durationMs) / 1000; // 回転の速さのまま進んだら動く距離
  const minDistance = travel / 3; // これ未満だと、動き始めの速さを保てない(3倍速を超える)
  let to = Infinity;
  loop.forEach((item, index) => {
    if (item.id !== targetId) return;
    const base = (index - WIN_ROW) * itemHeight; // 止める景品が当たりの行に来る位置
    const laps = Math.max(0, Math.ceil((from + minDistance - base) / cycle));
    to = Math.min(to, base + laps * cycle);
  });
  if (!Number.isFinite(to)) return null;
  const distance = to - from;
  return { from, to, slope: distance > 0 ? Math.min(3, travel / distance) : 0, durationMs };
}

/** 減速の曲線(0〜1 の進み具合 → 0〜1 の距離)。始めは傾き m、終わりは傾き 0 のエルミート曲線。 */
export function easeStop(u: number, slope: number): number {
  const t = Math.min(1, Math.max(0, u));
  return (t * t * t - 2 * t * t + t) * slope + (-2 * t * t * t + 3 * t * t);
}

/** 止め始めてから elapsedMs 経ったときの位置(折り返す前の値)。 */
export function positionAtStop(plan: StopPlan, elapsedMs: number): number {
  return plan.from + (plan.to - plan.from) * easeStop(elapsedMs / plan.durationMs, plan.slope);
}

/** 画面の大きさから決める、スロットの寸法(px)。 */
export interface SlotSize {
  itemHeight: number;
  reelWidth: number;
  font: number;
  gap: number;
  padding: number;
}

/** スロットの全体の高さ・幅のうち、マスの高さに比例する分と、枠(縁・電球)など一定の分。 */
const BLOCK_H_PER_ITEM = 3.46;
const BLOCK_H_FIXED = 60;
const BLOCK_W_PER_ITEM = 8.34;
const BLOCK_W_FIXED = 64;
/** 画面に対してスロット全体が占める上限(高さは演出の舞台の7割台、幅はほぼ全幅)。 */
const BLOCK_MAX_H_RATIO = 0.76;
const BLOCK_MAX_W_RATIO = 0.94;
const ITEM_MIN = 20;
const ITEM_MAX = 260;

/**
 * 画面(窓)の大きさからスロットの寸法を決める。高さに合わせて大きくし、横が足りない画面では幅に合わせて小さくする。
 * 遠くからでも読めるよう、ルーレットと同じくらい画面を使う。窓の大きさだけから決めるので、自分の大きさに依存して揺れない。
 */
export function computeSlotSize(viewportWidth: number, viewportHeight: number): SlotSize {
  const byHeight = (viewportHeight * BLOCK_MAX_H_RATIO - BLOCK_H_FIXED) / BLOCK_H_PER_ITEM;
  const byWidth = (viewportWidth * BLOCK_MAX_W_RATIO - BLOCK_W_FIXED) / BLOCK_W_PER_ITEM;
  const itemHeight = Math.max(ITEM_MIN, Math.min(ITEM_MAX, Math.round(Math.min(byHeight, byWidth))));
  return {
    itemHeight,
    reelWidth: Math.round(itemHeight * 2.6),
    font: Math.max(12, Math.round(itemHeight * 0.34)),
    gap: Math.round(itemHeight * 0.12),
    padding: Math.round(itemHeight * 0.15),
  };
}
