// WebSocket が使えない端末のフォールバック(sessionHub_poll の定期取得 + RPC での回答)。
// WsSession と同じ使い方ができるようにしてあり、サーバが指示する次回までの待ち時間(nextPollMs)に従って取得する。

import { rpc, RpcError } from "./http.mjs";
import { WsRejected, WsSession } from "./ws-client.mjs";

const MIN_POLL_MS = 1_000;

export class PollSession extends WsSession {
  constructor(env, identity) {
    super(env, identity);
    this.timer = null;
    this.stopped = false;
    this.lastPollMs = 4_000;
    this.polling = false;
  }

  get connected() {
    return !this.stopped;
  }

  async connect() {
    this.stopped = false;
    this.closeCode = null;
    await this.pollOnce();
    this.schedule();
    return this;
  }

  schedule() {
    if (this.stopped) return;
    this.timer = setTimeout(async () => {
      await this.pollOnce().catch(() => undefined);
      this.schedule();
    }, Math.max(MIN_POLL_MS, this.lastPollMs));
    this.timer.unref?.();
  }

  async pollOnce() {
    if (this.polling) return;
    this.polling = true;
    try {
      const { sessionId, deviceId, token } = this.identity;
      const result = await rpc(this.env, "sessionHub_poll", { sessionId, deviceId, token, sinceSeq: this.seq, stateVersion: this.stateVersion });
      this.lastPollMs = result.nextPollMs ?? this.lastPollMs;
      this.handle({ t: "update", result });
    } finally {
      this.polling = false;
    }
  }

  async answer(key, no) {
    const { sessionId, deviceId, token } = this.identity;
    const started = Date.now();
    try {
      const result = await rpc(this.env, "sessionHub_submitAnswer", { sessionId, deviceId, token, key, no }, null, {
        expect: ["ROUND_CLOSED", "ROUND_NOT_OPEN"],
      });
      this.env.metrics.time("poll:answer", Date.now() - started);
      return result;
    } catch (e) {
      if (e instanceof RpcError && e.code) throw new WsRejected(e.code, e.message);
      throw e;
    }
  }

  async issue(game, type, payload) {
    const { sessionId, deviceId, token } = this.identity;
    const requestId = `${this.identity.label}-issue-${this.nextRequest++}`.slice(0, 64);
    try {
      return await rpc(this.env, "sessionHub_issueCommand", { sessionId, deviceId, token, requestId, game, type, ...(payload === undefined ? {} : { payload }) }, null, {
        expect: ["FORBIDDEN"],
      });
    } catch (e) {
      if (e instanceof RpcError && e.code) throw new WsRejected(e.code, e.message);
      throw e;
    }
  }

  ack() {
    // ポーリングの端末はホストにならないので何もしない
  }

  close() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async reconnect() {
    this.close();
    return this.connect();
  }
}
