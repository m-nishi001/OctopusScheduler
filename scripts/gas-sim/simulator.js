/**
 * GAS 実行環境シミュレーター(Node)。
 *
 * `dist/gas/server.js`(GAS 向けバンドル)を、本物の Apps Script に近い条件で動かす:
 *   - 実行ごとに状態がまっさらな vm コンテキスト(worker_thread のプールで並列に動く。既定 20 / GAS_SIM_CONCURRENCY)
 *   - 呼び出しごとの遅延(既定 200ms ± ゆらぎ / GAS_SIM_LATENCY_MS)
 *   - 同時実行の上限超過は `Service invoked too many times in a short time`
 *   - 共有状態(Properties / Cache / Drive / Lock)はメインスレッドで持ち、LockService.waitLock は本物と同様にブロックする
 *   - ScriptProperties の 1 値 9KB・合計 500KB、Cache の 100KB、実行時間 6 分の上限
 *   - GAS に無いもの(setTimeout / crypto / structuredClone / TextEncoder / URL ...)はサンドボックスに置かない
 * ブラウザ側は `GET /` で doGet の結果(dist/gas/index.html)に偽の `google.script.*` を注入して返し、
 * 偽の `google.script.run` は `POST /rpc`(Cloudflare 版と同じ形式)でサーバー関数を呼ぶ。
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, MessageChannel } from "node:worker_threads";
import { SimState } from "./state.js";
import { browserShim } from "./browser-shim.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const THROTTLE_MESSAGE = "Service invoked too many times in a short time";
export const TIMEOUT_MESSAGE = "Exceeded maximum execution time";

const envNumber = (name, fallback, env = process.env) => {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} は 0 以上の数値で指定してください: ${raw}`);
  return n;
};

/** 環境変数から既定のオプションを組み立てる。 */
export function optionsFromEnv(env = process.env) {
  return {
    concurrency: envNumber("GAS_SIM_CONCURRENCY", 20, env),
    latencyMs: envNumber("GAS_SIM_LATENCY_MS", 200, env),
    execLimitMs: envNumber("GAS_SIM_EXEC_LIMIT_MS", 360_000, env),
    driveLatencyMs: envNumber("GAS_SIM_DRIVE_LATENCY_MS", 0, env),
    verbose: env.GAS_SIM_VERBOSE === "1",
    trace: env.GAS_SIM_TRACE === "1",
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * シミュレーターを起動する。
 * @param {object} options
 * @param {string} options.serverPath GAS サーバーバンドル(dist/gas/server.js)
 * @param {string} options.htmlDir  HtmlService.createTemplateFromFile が読む HTML のあるディレクトリ(dist/gas)
 * @param {number} [options.port] 0 で空きポート
 * @param {number} [options.concurrency] 同時に動かせる実行の数(= ワーカー数)
 * @param {number} [options.latencyMs] 1 呼び出しあたりの遅延(±25% のゆらぎ)
 * @param {number} [options.execLimitMs] 1 実行の上限時間
 * @param {number} [options.driveLatencyMs] Drive 操作 1 回あたりの遅延(既定 0)
 * @param {SimState} [options.state] 共有状態(シード済みのものを渡せる)
 * @param {boolean} [options.verbose] console の出力を標準エラーへ流す(GAS_SIM_VERBOSE=1)
 * @param {boolean} [options.trace] 呼び出し 1 回ごとに、関数名・引数・結果を標準エラーへ流す(GAS_SIM_TRACE=1。デバッグ用)
 */
export async function startSimulator(options) {
  const defaults = optionsFromEnv();
  const {
    serverPath,
    htmlDir,
    port = 0,
    concurrency = defaults.concurrency,
    latencyMs = defaults.latencyMs,
    execLimitMs = defaults.execLimitMs,
    driveLatencyMs = defaults.driveLatencyMs,
    verbose = defaults.verbose,
    trace = defaults.trace,
    state = new SimState(),
  } = options;

  const serverSource = readFileSync(serverPath, "utf8");
  const bootstrapSource = readFileSync(join(HERE, "bootstrap.js"), "utf8");

  const stats = { executions: 0, throttled: 0, timeouts: 0, peakInFlight: 0 };
  /** console の出力(直近 500 件)。テストやデバッグ用。 */
  const logs = [];
  let inFlight = 0;
  let closed = false;
  let execSeq = 0;
  let baseUrl = "";

  // ---------- ワーカーのプール ----------
  /** @type {Array<ReturnType<typeof spawnWorker>>} */
  const idle = [];
  /** @type {Array<(w: any) => void>} */
  const waiting = [];

  /** 同期 RPC の 1 リクエストを処理して、応答をワーカーへ返す。 */
  async function handleCall(slot, msg) {
    let reply;
    try {
      reply = { ok: true, v: (await dispatch(msg.execId, msg.op, msg.args)) ?? null };
    } catch (e) {
      reply = { ok: false, m: String(e?.message ?? e) };
    }
    if (driveLatencyMs > 0 && msg.op.startsWith("drive.")) await sleep(driveLatencyMs);
    if (slot.dead) return;
    slot.replyPort.postMessage(reply);
    Atomics.store(slot.i32, 0, 1);
    Atomics.notify(slot.i32, 0);
  }

  async function dispatch(execId, op, a) {
    switch (op) {
      case "props.get":
        return state.getProperty(a[0]);
      case "props.set":
        return state.setProperty(a[0], a[1]);
      case "props.delete":
        return state.deleteProperty(a[0]);
      case "props.keys":
        return state.propertyKeys();
      case "cache.get":
        return state.cacheGet(a[0]);
      case "cache.put":
        return state.cachePut(a[0], a[1], a[2]);
      case "cache.remove":
        return state.cacheRemove(a[0]);
      case "lock.wait":
        return state.lockWait(execId, a[0]);
      case "lock.try":
        return state.lockTry(execId);
      case "lock.has":
        return state.lockHas(execId);
      case "lock.release":
        return state.lockRelease(execId);
      case "drive.rootId":
        return state.rootFolderId;
      case "drive.folder":
        return state.getFolder(a[0]);
      case "drive.file":
        return state.getFile(a[0]);
      case "drive.children":
        return state.listChildren(a[0], a[1], a[2]);
      case "drive.createFolder":
        return state.createFolder(a[0], a[1]);
      case "drive.createFile":
        return state.createFile(a[0], a[1], a[2], Buffer.from(a[3], "base64"));
      case "drive.content":
        return state.fileContent(a[0]).toString("base64");
      case "drive.setContent":
        return state.setFileContent(a[0], Buffer.from(a[1], "base64"));
      case "drive.setName":
        return state.setName(a[0], a[1]);
      case "drive.setTrashed":
        return state.setTrashed(a[0], a[1]);
      case "log": {
        const line = `[${a[0]}] ${a[1]}`;
        logs.push(line);
        if (logs.length > 500) logs.shift();
        if (verbose) console.error(`[gas-sim] ${line}`);
        return null;
      }
      default:
        throw new Error(`gas-sim: 未対応の操作です: ${op}`);
    }
  }

  function spawnWorker() {
    const signal = new SharedArrayBuffer(4);
    const { port1, port2 } = new MessageChannel();
    const worker = new Worker(join(HERE, "worker.js"), {
      workerData: {
        signal,
        replyPort: port2,
        serverSource,
        serverPath,
        bootstrapSource,
        htmlDir,
        scriptUrl: baseUrl,
      },
      transferList: [port2],
    });
    const slot = { worker, i32: new Int32Array(signal), replyPort: port1, dead: false, onDone: null };
    worker.on("message", (msg) => {
      if (msg.type === "call") void handleCall(slot, msg);
      else if (msg.type === "done") slot.onDone?.(msg);
    });
    worker.on("error", (e) => slot.onDone?.({ type: "done", ok: false, message: String(e?.message ?? e) }));
    return slot;
  }

  // workerData のゲッターは構造化複製で値になるため、URL が決まってから起動する(下の listen の後)
  function release(slot) {
    const next = waiting.shift();
    if (next) next(slot);
    else idle.push(slot);
  }
  function acquire() {
    const slot = idle.pop();
    if (slot) return Promise.resolve(slot);
    return new Promise((resolve) => waiting.push(resolve));
  }

  /** 実行 1 回。結果は {ok:true, out}(out は bootstrap の JSON 文字列)か {ok:false, message}。 */
  async function runOnWorker(fn, argJson) {
    const slot = await acquire();
    const execId = `exec-${++execSeq}`;
    stats.executions++;
    let timer;
    try {
      return await new Promise((resolve) => {
        slot.onDone = (msg) => resolve(msg);
        timer = setTimeout(() => {
          // 上限時間を超えた実行は打ち切る(ワーカーごと捨てて作り直す)
          stats.timeouts++;
          slot.dead = true;
          void slot.worker.terminate();
          resolve({ type: "done", ok: false, message: TIMEOUT_MESSAGE, killed: true });
        }, execLimitMs);
        slot.worker.postMessage({ type: "run", execId, fn, argJson });
      });
    } finally {
      clearTimeout(timer);
      slot.onDone = null;
      state.endExecution(execId);
      if (slot.dead) {
        const fresh = spawnWorker();
        release(fresh);
      } else {
        release(slot);
      }
    }
  }

  /**
   * サーバー関数を 1 回呼ぶ(google.script.run の 1 呼び出しに相当)。
   * @returns {Promise<{ ok: true, result: object } | { ok: false, message: string, throttled?: boolean }>}
   */
  async function invoke(fn, arg) {
    if (closed) return { ok: false, message: "simulator is closed" };
    if (inFlight >= concurrency) {
      stats.throttled++;
      return { ok: false, message: `Exception: ${THROTTLE_MESSAGE}`, throttled: true };
    }
    inFlight++;
    stats.peakInFlight = Math.max(stats.peakInFlight, inFlight);
    try {
      if (latencyMs > 0) await sleep(latencyMs * (0.75 + Math.random() * 0.5));
      const started = Date.now();
      const done = await runOnWorker(fn, arg === undefined ? null : JSON.stringify(arg));
      if (trace) {
        const clip = (v, n = 300) => String(v).slice(0, n);
        // 読みやすいように、毎回同じ資格情報の欄は省く
        const brief = JSON.stringify(arg)?.replace(/"(?:sessionId|deviceId|token|__octopusAuth)":"[^"]*",?/g, "");
        console.error(`[gas-sim] ${new Date().toISOString().slice(11, 23)} ${fn}(${clip(brief, 400)}) ${Date.now() - started}ms -> ${done.ok ? clip(done.out, 200) : `ERROR ${done.message}`}`);
      }
      if (!done.ok) return { ok: false, message: done.message };
      return { ok: true, result: JSON.parse(done.out) };
    } finally {
      inFlight--;
    }
  }

  // ---------- HTTP ----------
  const readBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });

  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  };

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://sim.local");
      if (req.method === "POST" && url.pathname === "/rpc") {
        let parsed;
        try {
          parsed = JSON.parse(await readBody(req));
        } catch {
          return json(res, 400, { status: "error", message: "invalid JSON body" });
        }
        const out = await invoke(String(parsed?.name ?? ""), parsed?.args);
        if (!out.ok) return json(res, out.throttled ? 429 : 500, { status: "error", message: out.message });
        const r = out.result;
        // サーバー関数の戻り値(JSON 文字列)をそのまま本文にする。google.script.run の成功ハンドラが受け取る値と同じ。
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        return res.end(r.kind === "string" ? r.value : r.kind === "undefined" ? "null" : JSON.stringify(r.value ?? r));
      }
      if (req.method === "GET" && url.pathname === "/__sim/stats") {
        return json(res, 200, { ...stats, inFlight, concurrency, properties: state.properties.size, propertiesBytes: state.propertiesBytes(), lock: state.stats });
      }
      if (req.method === "GET" && url.pathname === "/__sim/logs") return json(res, 200, logs);
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        const parameter = Object.fromEntries(url.searchParams);
        const out = await invoke("doGet", { parameter, parameters: Object.fromEntries([...url.searchParams.keys()].map((k) => [k, url.searchParams.getAll(k)])) });
        if (!out.ok) return json(res, 500, { status: "error", message: out.message });
        if (out.result.kind !== "html") return json(res, 500, { status: "error", message: "doGet が HtmlOutput を返しませんでした" });
        const { title, metas, content } = out.result;
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(renderPage(content, title, metas));
      }
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    } catch (e) {
      json(res, 500, { status: "error", message: String(e?.message ?? e) });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  for (let i = 0; i < concurrency; i++) idle.push(spawnWorker());

  return {
    url: baseUrl,
    port: server.address().port,
    state,
    stats,
    logs,
    invoke,
    inFlight: () => inFlight,
    async close() {
      closed = true;
      await new Promise((r) => server.close(r));
      server.closeAllConnections?.();
      await Promise.all([...idle].map((s) => s.worker.terminate()));
    },
  };
}

/** doGet が返した HtmlOutput(本文 + タイトル + meta)を、偽の google.script.* を注入した完全なページにする。 */
export function renderPage(content, title, metas) {
  const metaTags = (metas ?? []).map(([n, c]) => `<meta name="${escapeAttr(n)}" content="${escapeAttr(c)}">`).join("");
  const inject = `${metaTags}<script>${browserShim()}</script>`;
  let html = content;
  if (title) html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeText(title)}</title>`);
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${inject}`) : `${inject}${html}`;
}

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escapeText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
