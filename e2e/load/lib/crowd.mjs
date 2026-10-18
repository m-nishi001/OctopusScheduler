// 合成の参加者(群衆)。実ブラウザのホスト・管理端末が公開する状態を見て、参加者のスマホと同じように反応する。
//   - エントリー受付が開いたら、ばらつきを付けてエントリーする
//   - クイズが出題されたら、問題ごとの癖(一斉に答える / 選び直しが多い / 連打)で答える
//   - ジャックポットで自分が当選者なら、停止操作を送る
//   - 結果の発表(クイズの結果の画面)になったら、結果を取得する
// 実際に何を送ったかはすべて Participant に記録されるので、あとで保存された内容と突き合わせられる。

import { readEvent, readQuiz, sleep } from "./participant.mjs";
import { WsRejected } from "./ws-client.mjs";

const PROFILES = {
  /** 出題の直後に全員が答える。2割は二度押し。 */
  burst: (index, ctx) => {
    const at = ctx.now + 200 + ctx.rand(0, 600);
    const steps = [{ at, no: ctx.pickNo() }];
    if (index % 5 === 0) steps.push({ at: at + 120, no: steps[0].no });
    return steps;
  },
  /** 回答がばらけ、選び直しが多い。 */
  spread: (index, ctx) => {
    let at = ctx.now + ctx.rand(300, 4_000);
    const steps = [{ at, no: ctx.pickNo() }];
    const changes = index % 5 < 3 ? 1 : index % 5 === 3 ? 2 : 0;
    for (let k = 0; k < changes; k++) {
      at += ctx.rand(300, 2_000);
      steps.push({ at, no: ctx.pickNo(steps.at(-1).no) });
    }
    return steps;
  },
  /** 数秒のあいだに何度も押し直す。 */
  storm: (_index, ctx) => {
    const steps = [];
    let last = 0;
    for (let k = 0; k < 6; k++) {
      const no = ctx.pickNo(last);
      last = no;
      steps.push({ at: ctx.now + 200 + ctx.rand(0, 2_000), no });
    }
    return steps.sort((a, b) => a.at - b.at);
  },
};

export class Crowd {
  /**
   * @param {{base: string, metrics: import("./metrics.mjs").Metrics}} env
   * @param {import("./participant.mjs").Participant[]} participants 接続済みの参加者
   * @param {{rand: (min: number, max: number) => number, profiles?: string[], onResults?: (p: any) => Promise<void>}} options
   *   profiles: 出題ごとの癖(順に使い、足りなければ最後を繰り返す)
   */
  constructor(env, participants, options) {
    this.env = env;
    this.participants = participants;
    this.rand = options.rand;
    this.profiles = options.profiles ?? ["burst"];
    this.onResults = options.onResults ?? null;
    this.offs = [];
    /** 出題(roundKey)の順番。 */
    this.roundOrder = [];
    this.handled = new Map();
    /** 停止操作の結果(ジャックポット)。 */
    this.stopAttempts = [];
    this.stopped = false;
    this.pending = new Set();
    this.resultsFetched = new Set();
    this.entered = new Set();
  }

  start() {
    for (const p of this.participants) {
      this.offs.push(p.session.onUpdate((s) => this.react(p, s)));
      this.react(p, p.session);
    }
  }

  stop() {
    this.stopped = true;
    for (const off of this.offs) off();
    this.offs = [];
  }

  /** 走らせている反応がすべて終わるまで待つ。 */
  async idle(timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    while (this.pending.size > 0 && Date.now() < deadline) await sleep(100);
    return this.pending.size === 0;
  }

  track(promise) {
    const wrapped = promise.catch((e) => this.env.metrics.error("crowd", e?.message ?? e)).finally(() => this.pending.delete(wrapped));
    this.pending.add(wrapped);
  }

  once(p, key) {
    const set = this.handled.get(p.id) ?? new Set();
    this.handled.set(p.id, set);
    if (set.has(key)) return false;
    set.add(key);
    return true;
  }

  react(p, s) {
    if (this.stopped) return;
    const data = s.data;
    const event = readEvent(data);
    const quiz = readQuiz(data);

    if (event?.entry?.open === true && this.once(p, `entry:${event.entry.key}`)) {
      this.track(
        (async () => {
          await sleep(this.rand(0, 1_500));
          await p.submit(event.entry.key, 1);
          this.entered.add(p.id);
        })()
      );
    }

    if (quiz?.phase === "answering" && quiz.roundKey && this.once(p, `quiz:${quiz.roundKey}`)) {
      if (!this.roundOrder.includes(quiz.roundKey)) this.roundOrder.push(quiz.roundKey);
      const order = this.roundOrder.indexOf(quiz.roundKey);
      const profile = PROFILES[this.profiles[Math.min(order, this.profiles.length - 1)]] ?? PROFILES.burst;
      const options = (quiz.options ?? []).map((o) => o.no);
      const offset = s.serverOffsetMs ?? 0;
      const deadlineLocal = (quiz.deadlineMs ?? Date.now() + 60_000) - offset;
      const ctx = {
        now: Date.now(),
        rand: this.rand,
        pickNo: (not) => {
          const choices = options.filter((n) => n !== not);
          return choices[Math.floor(this.rand(0, choices.length - 0.001))];
        },
      };
      const steps = profile(p.index, ctx).filter((step) => step.at < deadlineLocal - 1_500);
      this.track(
        (async () => {
          for (const step of steps) {
            const wait = step.at - Date.now();
            if (wait > 0) await sleep(wait);
            if (this.stopped) return;
            await p.submit(quiz.roundKey, step.no);
          }
        })()
      );
    }

    const jackpot = data.jackpot;
    if (jackpot && jackpot.stage === "prize" && jackpot.canStop === true && jackpot.memberId === p.id && this.once(p, `stop:${jackpot.memberId}:${jackpot.prize ?? ""}:${s.stateVersion}`)) {
      this.track(
        (async () => {
          await sleep(this.rand(300, 1_500));
          try {
            await p.session.issue("jackpot", "stopRoulette");
            this.stopAttempts.push({ id: p.id, ok: true });
          } catch (e) {
            // 管理端末が先に止めたあとの拒否などは想定内。権限の拒否(FORBIDDEN)は当選者本人には出ないはず。
            this.stopAttempts.push({ id: p.id, ok: false, code: e instanceof WsRejected ? e.code : String(e) });
          }
        })()
      );
    }

    if (quiz?.page === "result" && this.onResults && this.once(p, `results:${quiz.roundKey ?? this.roundOrder.at(-1) ?? "none"}`)) {
      this.track(
        (async () => {
          await sleep(this.rand(0, 2_000));
          await this.onResults(p);
          this.resultsFetched.add(p.id);
        })()
      );
    }
  }
}
