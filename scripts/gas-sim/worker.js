/**
 * GAS シミュレーターの実行ワーカー(worker_thread)。
 *
 * 1 回の実行ごとに、状態がまっさらな vm コンテキストを作ってサーバーバンドル(dist/gas/server.js)を読み込み、
 * 指定のサーバー関数を呼ぶ(本物の GAS と同じく、グローバル変数は実行をまたいで残らない)。
 * 共有状態(Properties / Cache / Drive / Lock)はメインスレッドにあり、同期 RPC で読み書きする:
 *   ワーカー: メインへ postMessage → Atomics.wait で止まる → 応答が来たら receiveMessageOnPort で読む。
 * `LockService.waitLock` はメインが応答を遅らせることで、本物と同じようにブロックする。
 */
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parentPort, receiveMessageOnPort, workerData } from "node:worker_threads";
import vm from "node:vm";

const { signal, replyPort, serverSource, serverPath, bootstrapSource, htmlDir, scriptUrl } = workerData;
const i32 = new Int32Array(signal);

const serverScript = new vm.Script(serverSource, { filename: serverPath });
const bootstrap = new vm.Script(bootstrapSource, { filename: "gas-sim/bootstrap.js" });

let currentExecId = null;
let seq = 0;

/** メインスレッドへ同期 RPC。応答までこのスレッドは止まる。 */
function rpc(op, args) {
  const id = ++seq;
  Atomics.store(i32, 0, 0);
  parentPort.postMessage({ type: "call", execId: currentExecId, id, op, args });
  for (;;) {
    Atomics.wait(i32, 0, 0, 500);
    const got = receiveMessageOnPort(replyPort);
    if (got) return got.message;
  }
}

const signedOf = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const bufOfSigned = (arr) => Buffer.from(arr.map((b) => b & 0xff));

/** ワーカー内で完結する処理(RPC 不要)。 */
const local = {
  uuid: () => randomUUID(),
  b64ToSigned: (b64) => signedOf(Buffer.from(b64, "base64")),
  signedToB64: (arr) => bufOfSigned(arr).toString("base64"),
  utf8ToB64: (s) => Buffer.from(s, "utf8").toString("base64"),
  b64ToUtf8: (b64) => Buffer.from(b64, "base64").toString("utf8"),
  hmac: (valueB64, keyB64) => signedOf(createHmac("sha256", Buffer.from(keyB64, "base64")).update(Buffer.from(valueB64, "base64")).digest()),
  sleep: (ms) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, Number(ms) || 0));
    return null;
  },
  "script.url": () => scriptUrl,
  "html.read": (name) => readFileSync(join(htmlDir, `${name}.html`), "utf8"),
};

function hostCall(op, argsJson) {
  const args = JSON.parse(argsJson);
  try {
    if (op in local) return JSON.stringify({ ok: true, v: local[op](...args) ?? null });
    const res = rpc(op, args);
    return JSON.stringify(res);
  } catch (e) {
    return JSON.stringify({ ok: false, m: String(e?.message ?? e) });
  }
}

async function execute(fn, argJson) {
  const context = vm.createContext({}, { name: "gas-execution" });
  serverScript.runInContext(context);
  bootstrap.runInContext(context)({ call: hostCall });
  const invoke = context.__simInvoke;
  return await invoke(fn, argJson);
}

parentPort.on("message", async (msg) => {
  if (msg.type !== "run") return;
  currentExecId = msg.execId;
  try {
    const out = await execute(msg.fn, msg.argJson);
    parentPort.postMessage({ type: "done", execId: msg.execId, ok: true, out });
  } catch (e) {
    parentPort.postMessage({ type: "done", execId: msg.execId, ok: false, message: String(e?.message ?? e) });
  } finally {
    currentExecId = null;
  }
});
