// 運営側の端末(ホスト=投影PC、管理=スマホ)。管理者のログイントークンで入室し、実際のアプリと同じ RPC / WebSocket を使う。

import { rpc } from "./http.mjs";
import { WsSession } from "./ws-client.mjs";

export class Operator {
  /**
   * @param {{base: string, metrics: import("./metrics.mjs").Metrics}} env
   * @param {string} adminToken
   * @param {{role: "host" | "admin", label: string, deviceId: string}} spec
   */
  constructor(env, adminToken, spec) {
    this.env = env;
    this.adminToken = adminToken;
    this.role = spec.role;
    this.label = spec.label;
    this.deviceId = spec.deviceId;
    this.joined = null;
    /** @type {WsSession | null} */
    this.session = null;
    this.nextRequest = 1;
  }

  get creds() {
    return { sessionId: this.joined.session.id, deviceId: this.joined.deviceId, token: this.joined.token };
  }

  async join(sessionId, extra = {}) {
    this.joined = await rpc(this.env, "sessionHub_joinOperator", { sessionId, role: this.role, label: this.label, deviceId: this.deviceId, ...extra }, this.adminToken);
    this.session = new WsSession(this.env, { sessionId, deviceId: this.joined.deviceId, token: this.joined.token, label: this.label });
    return this.joined;
  }

  connect() {
    return this.session.connect();
  }

  call(name, args, options) {
    return rpc(this.env, name, { ...this.creds, ...args }, null, options);
  }

  /** コマンドを発行する(管理端末の操作)。 */
  issue(game, type, payload, { viaWs = false } = {}) {
    if (viaWs) return this.session.issue(game, type, payload);
    return this.call("sessionHub_issueCommand", { requestId: `${this.label}-cmd-${this.nextRequest++}`.slice(0, 64), game, type, ...(payload === undefined ? {} : { payload }) });
  }

  openRound(key, options, durationMs, extra = {}) {
    return this.call("sessionHub_openRound", { key, options, ...(durationMs === undefined ? {} : { durationMs }), ...extra });
  }

  closeRound(key) {
    return this.call("sessionHub_closeRound", { key });
  }

  getAnswers(key) {
    return this.call("sessionHub_getAnswers", { key });
  }

  close() {
    this.session?.close();
  }
}

/**
 * ホスト(投影PC)。アプリのホストと同じく、名前空間ごとの状態(slice)を持ち、全体をまとめて公開する。
 * 管理端末のコマンドを受けたら適用済みを報告する(ack)。
 */
export class HostOperator extends Operator {
  constructor(env, adminToken, spec) {
    super(env, adminToken, { ...spec, role: "host" });
    this.slices = {};
    this.clientInputs = new Map();
    this.published = [];
  }

  async connect() {
    await super.connect();
    // 受け取ったコマンドを適用済みとして報告する(在席に ackSeq が反映される)
    this.session.onUpdate((s) => {
      if (s.commands.length) s.ack(s.seq);
    });
    return this;
  }

  /** 名前空間 ns の状態を更新して公開する。data が null なら消す。 */
  async publishSlice(ns, data, clientInput) {
    if (data === null) delete this.slices[ns];
    else this.slices[ns] = data;
    if (clientInput) this.clientInputs.set(ns, clientInput);
    else if (data === null) this.clientInputs.delete(ns);
    const started = Date.now();
    const result = await this.call("sessionHub_publishState", { data: { ...this.slices }, clientInput: [...this.clientInputs.values()].flat() });
    this.published.push({ ns, version: result.version, startedAt: started });
    return { version: result.version, startedAt: started };
  }
}

/**
 * 運営端末が回答の一覧を追いかける動き(アプリの useRoundAnswers と同じ)。
 * 更新の通知で届く回答数/更新番号が変わったときだけ、最短 1.5 秒間隔で getAnswers を呼ぶ。
 */
export class RosterWatcher {
  /** @param {Operator} operator */
  constructor(operator, key, minIntervalMs = 1_500) {
    this.operator = operator;
    this.key = key;
    this.minIntervalMs = minIntervalMs;
    this.lastSignature = "";
    this.lastFetchAt = -Infinity;
    this.timer = null;
    this.stopped = false;
    this.latest = null;
    this.fetches = 0;
    this.off = operator.session.onUpdate((s) => this.onUpdate(s));
    this.onUpdate(operator.session);
  }

  onUpdate(session) {
    const round = session.round;
    if (!round || round.key !== this.key) return;
    const signature = `${round.answerCount}:${round.answerRev}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.schedule();
  }

  schedule() {
    if (this.stopped || this.timer) return;
    const wait = Math.max(0, this.lastFetchAt + this.minIntervalMs - Date.now());
    this.timer = setTimeout(async () => {
      this.timer = null;
      this.lastFetchAt = Date.now();
      try {
        this.latest = await this.operator.getAnswers(this.key);
        this.fetches++;
      } catch {
        // 失敗は rpc 側で計測済み。次の変化で取り直す
      }
    }, wait);
  }

  stop() {
    this.stopped = true;
    this.off();
    if (this.timer) clearTimeout(this.timer);
  }
}
