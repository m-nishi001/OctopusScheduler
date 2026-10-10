/**
 * ポーリングによる SessionTransport。
 *
 * - 間隔はサーバが `nextPollMs` で指示した値に従う(±10% のジッタで一斉アクセスをばらす)
 * - 失敗時は指数バックオフ(上限あり)。復帰したら指示値に戻る
 * - 画面が非表示の間は間隔を延ばす(可視に戻ったら即時取得)
 * - 一定期間の取得回数に上限を設け、超えたら下限間隔へ強制的に落とす
 *   (想定外の暴走で GAS / 無料枠のクォータを使い切らないための保険)
 */
import type { SessionHubApi } from "../../server/session-hub-api-contract";
import type { PollResult } from "../../shared/protocol";
import type { SessionTransport, TransportSource } from "./transport";

export interface PollingOptions {
  /** 初回/応答に nextPollMs が無いときの間隔。 */
  defaultIntervalMs: number;
  /** 非表示タブでの間隔の下限(これより短くしない)。 */
  hiddenMinIntervalMs: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  jitterRatio: number;
  /** この窓(ms)内の取得回数を数える。 */
  budgetWindowMs: number;
  /** 窓内の最大取得回数。超えたら budgetFloorMs 以上に間隔を引き上げる。 */
  budgetMaxPolls: number;
  budgetFloorMs: number;
}

export const DEFAULT_POLLING_OPTIONS: PollingOptions = {
  defaultIntervalMs: 3000,
  hiddenMinIntervalMs: 30_000,
  backoffBaseMs: 2000,
  backoffMaxMs: 30_000,
  jitterRatio: 0.1,
  budgetWindowMs: 10 * 60 * 1000,
  // 最短の host 間隔(1秒)でも 600回/10分。余裕を見て上限は 1000 回。
  budgetMaxPolls: 1000,
  budgetFloorMs: 15_000,
};

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
  random(): number;
}

export const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
  random: () => Math.random(),
};

export class PollingTransport implements SessionTransport {
  private source: TransportSource | null = null;
  private timer: unknown = null;
  private running = false;
  private inFlight = false;
  private visible = true;
  private failures = 0;
  private lastNextPollMs: number;
  private pollTimes: number[] = [];

  constructor(
    private readonly api: Pick<SessionHubApi, "poll">,
    private readonly timers: Timers = realTimers,
    private readonly options: PollingOptions = DEFAULT_POLLING_OPTIONS
  ) {
    this.lastNextPollMs = options.defaultIntervalMs;
  }

  start(source: TransportSource): void {
    this.stop();
    this.source = source;
    this.running = true;
    this.failures = 0;
    this.schedule(0);
  }

  stop(): void {
    this.running = false;
    this.source = null;
    this.clearTimer();
  }

  setVisible(visible: boolean): void {
    const wasHidden = !this.visible;
    this.visible = visible;
    if (this.running && visible && wasHidden) this.kick();
  }

  kick(): void {
    if (!this.running || this.inFlight) return;
    this.schedule(0);
  }

  /** テスト用: 直近の窓内での取得回数。 */
  get recentPollCount(): number {
    this.trimWindow();
    return this.pollTimes.length;
  }

  private clearTimer(): void {
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(ms: number): void {
    this.clearTimer();
    if (!this.running) return;
    this.timer = this.timers.setTimeout(() => void this.tick(), Math.max(0, ms));
  }

  private trimWindow(): void {
    const cutoff = this.timers.now() - this.options.budgetWindowMs;
    while (this.pollTimes.length && this.pollTimes[0] < cutoff) this.pollTimes.shift();
  }

  private jitter(ms: number): number {
    const spread = ms * this.options.jitterRatio;
    return Math.round(ms + (this.timers.random() * 2 - 1) * spread);
  }

  /** 次の取得までの待ち時間。 */
  private nextDelay(): number {
    let base: number;
    if (this.failures > 0) {
      base = Math.min(this.options.backoffBaseMs * 2 ** (this.failures - 1), this.options.backoffMaxMs);
    } else {
      base = this.lastNextPollMs;
    }
    if (!this.visible) base = Math.max(base, this.options.hiddenMinIntervalMs);
    this.trimWindow();
    if (this.pollTimes.length >= this.options.budgetMaxPolls) base = Math.max(base, this.options.budgetFloorMs);
    return this.jitter(base);
  }

  private async tick(): Promise<void> {
    const source = this.source;
    if (!this.running || !source || this.inFlight) return;
    this.inFlight = true;
    this.pollTimes.push(this.timers.now());
    try {
      let result: PollResult;
      try {
        result = await this.api.poll(source.buildPollArgs());
      } catch (error) {
        this.failures++;
        if (source.onError(error, this.failures) === "stop") {
          this.running = false;
          return;
        }
        return;
      }
      this.failures = 0;
      if (Number.isFinite(result.nextPollMs) && result.nextPollMs > 0) this.lastNextPollMs = result.nextPollMs;
      try {
        await source.onUpdate(result);
      } catch {
        // 更新の適用失敗でポーリングを止めない(次回の取得で再度追従する)
      }
    } finally {
      this.inFlight = false;
      if (this.running) this.schedule(this.nextDelay());
    }
  }
}
