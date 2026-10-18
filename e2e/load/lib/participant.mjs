// 参加者1人分の振る舞い。ログイン済みのスマホとして入室し、ホストが公開する状態を見て反応する。
// 回答は「サーバが返した内容」をすべて記録しておき、あとで保存された内容と突き合わせる。

import { rpc } from "./http.mjs";
import { PollSession } from "./poll-client.mjs";
import { WsRejected, WsSession } from "./ws-client.mjs";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 再現できる乱数(LOAD_SEED で固定)。 */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function readQuiz(data) {
  const q = data?.quiz;
  return q && typeof q === "object" ? q : null;
}

export function readEvent(data) {
  const e = data?.event;
  return e && typeof e === "object" ? e : null;
}

export class Participant {
  /**
   * @param {{base: string, metrics: import("./metrics.mjs").Metrics}} env
   * @param {{index: number, id: string, name: string, loginKey: string, transport: "ws" | "poll"}} spec
   */
  constructor(env, spec) {
    this.env = env;
    this.index = spec.index;
    this.id = spec.id;
    this.name = spec.name;
    this.loginKey = spec.loginKey;
    this.transport = spec.transport;
    this.token = null;
    this.device = null;
    /** @type {WsSession | null} */
    this.session = null;
    /** 回答ごとの記録: roundKey → { responses: [{no, atMs, duplicate, sentAt, ackedAt}], rejected: [{no, code}] } */
    this.rounds = new Map();
  }

  get label() {
    return `p${String(this.index).padStart(2, "0")}`;
  }

  /** 受付QRのキーでログインする。 */
  async login(options) {
    const { token } = await rpc(this.env, "accounts_loginWithKey", { id: this.id, key: this.loginKey }, null, options);
    this.token = token;
  }

  /** ポータルのセッションへ入室する。 */
  async join(options) {
    this.device = await rpc(this.env, "sessionHub_joinPortal", {}, this.token, options);
    const Session = this.transport === "poll" ? PollSession : WsSession;
    this.session = new Session(this.env, {
      sessionId: this.device.session.id,
      deviceId: this.device.deviceId,
      token: this.device.token,
      label: this.label,
    });
  }

  connect() {
    return this.session.connect();
  }

  record(roundKey) {
    let r = this.rounds.get(roundKey);
    if (!r) {
      r = { responses: [], rejected: [] };
      this.rounds.set(roundKey, r);
    }
    return r;
  }

  /**
   * 回答を1回送る。サーバの応答(採用された内容、または拒否の理由)を記録して返す。
   * 拒否は例外にせず { rejected: code } で返す(締切後の試行など、想定内の拒否を数えるため)。
   */
  async submit(roundKey, no) {
    const rec = this.record(roundKey);
    const sentAt = Date.now();
    try {
      const res = await this.session.answer(roundKey, no);
      const response = { no: res.no, atMs: res.atMs, duplicate: res.duplicate, sentAt, ackedAt: Date.now(), requested: no };
      rec.responses.push(response);
      return response;
    } catch (e) {
      if (e instanceof WsRejected) {
        rec.rejected.push({ no, code: e.code, sentAt });
        return { rejected: e.code, requested: no };
      }
      throw e;
    }
  }

  /** この参加者が最後に採用された回答(サーバの応答ベース)。無ければ null。 */
  finalResponse(roundKey) {
    const list = this.rounds.get(roundKey)?.responses ?? [];
    return list.length ? list[list.length - 1] : null;
  }

  /**
   * クイズの1ラウンドで、出題を見てから回答する。
   * steps: [{ afterMs, no, expectClosed? }]  afterMs は「出題を受け取ってから」ではなく直前の手順からの待ち時間。
   */
  async playRound(roundKey, steps, { appearTimeoutMs = 20_000 } = {}) {
    await this.session.waitFor((s) => {
      const q = readQuiz(s.data);
      return q?.roundKey === roundKey && q.phase === "answering";
    }, appearTimeoutMs, `quiz round ${roundKey} to appear`);
    const results = [];
    for (const step of steps) {
      if (step.afterMs > 0) await sleep(step.afterMs);
      results.push(await this.submit(roundKey, step.no));
    }
    return results;
  }

  /** エントリー受付が開いているのを見て、エントリーする。 */
  async enter(entryKey, delayMs = 0) {
    await this.session.waitFor((s) => {
      const e = readEvent(s.data);
      return e?.entry?.key === entryKey && e.entry.open === true;
    }, 20_000, `entry ${entryKey} to open`);
    if (delayMs > 0) await sleep(delayMs);
    return this.submit(entryKey, 1);
  }

  close() {
    this.session?.close();
  }
}
