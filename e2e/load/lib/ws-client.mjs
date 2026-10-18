// session-hub の WebSocket クライアント(参加者・ホスト・管理端末で共通)。実際のクライアントと同じプロトコルで話す。
// 応答(answered / issued / rejected)は requestId で突き合わせ、所要時間を計測する。

const PING_INTERVAL_MS = 25_000;
const CONNECT_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 20_000;

export class WsRejected extends Error {
  constructor(code, message) {
    super(`[${code ?? "?"}] ${message}`);
    this.name = "WsRejected";
    this.code = code;
  }
}

export class WsSession {
  /**
   * @param {{base: string, metrics: import("./metrics.mjs").Metrics}} env
   * @param {{sessionId: string, deviceId: string, token: string, label: string}} identity
   */
  constructor(env, identity) {
    this.env = env;
    this.identity = identity;
    this.ws = null;
    this.state = null;
    this.stateVersion = 0;
    this.seq = 0;
    this.presence = null;
    this.round = null;
    this.sessionInfo = null;
    /** 受信したコマンド(新しいものが後ろ)。 */
    this.commands = [];
    /** 状態の version ごとの受信時刻(公開から全員に届くまでの時間を測る)。 */
    this.arrivals = new Map();
    this.updates = 0;
    this.closeCode = null;
    this.errors = [];
    this.pending = new Map();
    this.listeners = new Set();
    this.nextRequest = 1;
    this.pingTimer = null;
  }

  get data() {
    return this.state?.data ?? {};
  }

  get connected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.closeCode === null;
  }

  /** 状態や接続が変わるたびに呼ばれる。戻り値の関数で解除。 */
  onUpdate(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 接続して認証し、最初の update を受け取るまで待つ。 */
  connect({ sinceSeq = this.seq, stateVersion = this.stateVersion } = {}) {
    const { sessionId, deviceId, token } = this.identity;
    const started = Date.now();
    this.closeCode = null;
    return new Promise((resolve, reject) => {
      const url = `${this.env.base.replace(/^http/, "ws")}/ws/${sessionId}`;
      const ws = new WebSocket(url);
      this.ws = ws;
      let settled = false;
      const timer = setTimeout(() => finish(new Error(`WebSocket の接続がタイムアウトしました (${this.identity.label})`)), CONNECT_TIMEOUT_MS);
      const finish = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          this.env.metrics.error("ws-connect", err.message);
          reject(err);
        } else {
          this.env.metrics.time("ws:connect+auth", Date.now() - started);
          resolve(this);
        }
      };
      ws.onopen = () => ws.send(JSON.stringify({ t: "auth", sessionId, deviceId, token, sinceSeq, stateVersion }));
      ws.onmessage = (ev) => {
        if (ev.data === "pong") return;
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        this.handle(msg);
        if (msg.t === "update") finish();
        else if (msg.t === "error") finish(new Error(`auth error: ${msg.message}`));
      };
      ws.onerror = () => finish(new Error(`WebSocket error (${this.identity.label})`));
      ws.onclose = (ev) => {
        if (this.ws !== ws) return; // 再接続で置き換え済みの古い接続
        this.closeCode = ev.code;
        this.stopPing();
        for (const [id, p] of this.pending) {
          p.reject(new Error(`connection closed (${ev.code}) before response to ${id}`));
        }
        this.pending.clear();
        finish(new Error(`closed before first update (${ev.code})`));
        this.notify();
      };
      this.startPing();
    });
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send("ping");
    }, PING_INTERVAL_MS);
    this.pingTimer.unref?.();
  }

  stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  handle(msg) {
    if (msg.t === "update") {
      const r = msg.result;
      this.updates++;
      if (r.state) {
        this.state = r.state;
        const version = r.head?.stateVersion ?? r.state.version;
        this.stateVersion = version;
        if (!this.arrivals.has(version)) this.arrivals.set(version, Date.now());
      }
      if (r.head) this.seq = Math.max(this.seq, r.head.seq);
      if (r.commands?.length) this.commands.push(...r.commands);
      this.presence = r.presence ?? this.presence;
      this.round = r.round ?? null;
      this.sessionInfo = r.session ?? this.sessionInfo;
      this.notify();
    } else if (msg.t === "answered" || msg.t === "issued" || msg.t === "rejected") {
      const p = this.pending.get(msg.requestId);
      if (!p) return;
      this.pending.delete(msg.requestId);
      clearTimeout(p.timer);
      const elapsed = Date.now() - p.started;
      if (msg.t === "rejected") {
        this.env.metrics.time(`ws:${p.kind}:rejected`, elapsed);
        p.reject(new WsRejected(msg.code, msg.message));
      } else {
        this.env.metrics.time(`ws:${p.kind}`, elapsed);
        p.resolve(msg);
      }
    } else if (msg.t === "error") {
      this.errors.push(msg);
    }
  }

  notify() {
    for (const l of this.listeners) l(this);
  }

  request(kind, payload) {
    if (!this.connected) return Promise.reject(new Error(`not connected (${this.identity.label})`));
    const requestId = `${this.identity.label}-${kind}-${this.nextRequest++}`.slice(0, 64);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        this.env.metrics.error("ws-timeout", `${kind} ${requestId}`);
        reject(new Error(`timeout waiting for ${requestId}`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, { kind, started: Date.now(), resolve, reject, timer });
      this.env.metrics.count("ws:messages-sent");
      this.ws.send(JSON.stringify({ requestId, ...payload }));
    });
  }

  /** 回答する。受理されれば { no, atMs, duplicate }。拒否されれば WsRejected。 */
  answer(key, no) {
    return this.request("answer", { t: "answer", key, no });
  }

  /** コマンドを発行する(参加者の入力・運営のコマンド)。 */
  issue(game, type, payload) {
    return this.request("issue", { t: "issue", game, type, ...(payload === undefined ? {} : { payload }) });
  }

  ack(seq) {
    if (!this.connected) return;
    this.env.metrics.count("ws:messages-sent");
    this.ws.send(JSON.stringify({ t: "ack", seq }));
  }

  /** 条件を満たすまで更新を待つ。満たさずに時間切れなら例外。 */
  waitFor(predicate, timeoutMs, what = "condition") {
    if (predicate(this)) return Promise.resolve(this);
    return new Promise((resolve, reject) => {
      const off = this.onUpdate((self) => {
        if (!predicate(self)) return;
        clearTimeout(timer);
        off();
        resolve(self);
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error(`timeout (${timeoutMs}ms) waiting for ${what} (${this.identity.label})`));
      }, timeoutMs);
    });
  }

  /** 接続を切る(再接続の試験用に、サーバへ正常に閉じることを伝える)。 */
  close() {
    this.stopPing();
    const ws = this.ws;
    if (ws && ws.readyState <= WebSocket.OPEN) {
      try {
        ws.close(1000, "load-test");
      } catch {
        // 既に閉じている
      }
    }
  }

  /** 通信が突然途絶えた状態を再現する(クローズ処理なしで破棄)。 */
  drop() {
    this.close();
  }

  /** 再接続して、手元の seq / stateVersion から取り直す。 */
  async reconnect() {
    this.close();
    // 古い接続の onclose が新しい接続の状態を書き換えないよう、置き換える前に参照を外す
    this.ws = null;
    return this.connect({ sinceSeq: this.seq, stateVersion: this.stateVersion });
  }
}
