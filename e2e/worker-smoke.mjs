// 実 workerd(wrangler dev --local)に対する session-hub の疎通確認。scripts/e2e-local.js から実行する。
const BASE = process.env.BASE ?? "http://127.0.0.1:8821";
const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN ?? "e2e-admin-session-token-0001";

async function rpc(name, args, token) {
  const body = { name, args: token ? { __octopusAuth: token, args } : args };
  const res = await fetch(`${BASE}/rpc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (json.status !== "success") throw new Error(`${name}: ${json.message}`);
  return json.data;
}

function connect(sessionId, creds, sinceSeq = 0, stateVersion = 0) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE.replace("http", "ws")}/ws/${sessionId}`);
    const messages = [];
    ws.onopen = () => ws.send(JSON.stringify({ t: "auth", sessionId, ...creds, sinceSeq, stateVersion }));
    ws.onmessage = (ev) => {
      if (ev.data === "pong") return messages.push("pong");
      messages.push(JSON.parse(ev.data));
      if (messages.length === 1) resolve({ ws, messages });
    };
    ws.onerror = (e) => reject(new Error("ws error " + (e.message ?? "")));
    ws.onclose = (ev) => messages.push({ closed: ev.code });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`);
};

const meta = await rpc("sessionHub_createSession", { name: "E2E会場" }, ADMIN_TOKEN);
check("セッション作成(管理者)", !!meta.id && /^[A-Z2-9]{6}$/.test(meta.code), meta.code);

const host = await rpc("sessionHub_joinOperator", { sessionId: meta.id, role: "host", label: "PC", deviceId: "e2e-host-device-0001" }, ADMIN_TOKEN);
const admin = await rpc("sessionHub_joinOperator", { sessionId: meta.id, role: "admin", label: "Phone", deviceId: "e2e-admin-device-0001" }, ADMIN_TOKEN);
const client = await rpc("sessionHub_joinClient", { code: meta.code, label: "太郎" });
check("入室(host/admin/client)", host.role === "host" && admin.role === "admin" && client.role === "client");

try {
  await rpc("sessionHub_joinOperator", { sessionId: meta.id, role: "admin", label: "x" });
  check("未ログインの運営者入室は拒否", false);
} catch (e) {
  check("未ログインの運営者入室は拒否", /Unauthorized/.test(e.message), e.message);
}

const creds = (j) => ({ deviceId: j.deviceId, token: j.token });
const wsHost = await connect(meta.id, creds(host));
const wsAdmin = await connect(meta.id, creds(admin));
const wsClient = await connect(meta.id, creds(client));
check("WebSocket 認証と初回 update", [wsHost, wsAdmin, wsClient].every((c) => c.messages[0]?.t === "update"));

const bad = await connect(meta.id, { deviceId: client.deviceId, token: "wrong" }).catch(() => null);
await sleep(300);
check("不正トークンは error + 4401", bad?.messages.some((m) => m.t === "error") && bad.messages.some((m) => m.closed === 4401), JSON.stringify(bad?.messages?.slice(-2)));

await rpc("sessionHub_publishState", { sessionId: meta.id, ...creds(host), data: { session: { path: "/lobby" } }, clientInput: ["jackpot.stopRoulette"] });
await sleep(300);
const clientUpdates = wsClient.messages.filter((m) => m.t === "update");
check("状態公開が参加者へ push される", clientUpdates.at(-1)?.result.state?.data?.session?.path === "/lobby");

// 参加者が WebSocket で入力を送る
wsClient.ws.send(JSON.stringify({ t: "issue", requestId: "e2e-req-1", game: "jackpot", type: "stopRoulette" }));
await sleep(400);
check("参加者の入力(WS)が受理される", wsClient.messages.some((m) => m.t === "issued" && m.seq === 1));
check("ホストにコマンドが push される", wsHost.messages.some((m) => m.t === "update" && m.result.commands.some((c) => c.type === "stopRoulette" && c.issuerRole === "client")));

wsClient.ws.send(JSON.stringify({ t: "issue", requestId: "e2e-req-2", game: "jackpot", type: "forbiddenThing" }));
await sleep(300);
check("許可外の入力は rejected", wsClient.messages.some((m) => m.t === "rejected" && m.code === "FORBIDDEN"));

// ホストの ack → 在席に反映
wsHost.ws.send(JSON.stringify({ t: "ack", seq: 1 }));
await sleep(2600);
const lastAdmin = wsAdmin.messages.filter((m) => m.t === "update").at(-1);
check("ack が管理端末の在席に反映(alarm 経由)", lastAdmin?.result.presence.host?.ackSeq === 1, JSON.stringify(lastAdmin?.result.presence.host));
check("参加者数が反映", lastAdmin?.result.presence.clientCount === 1);

// ping/pong(auto-response)
wsClient.ws.send("ping");
await sleep(300);
check("ping に auto-response で pong", wsClient.messages.includes("pong"));

// 再接続: 古い接続は置き換えられる
const wsClient2 = await connect(meta.id, creds(client), 0, 0);
await sleep(300);
check("同じ端末の再接続で古い接続は 4409 になる", wsClient.messages.some((m) => m.closed === 4409));
check("再接続で状態を取り直す", wsClient2.messages[0]?.result?.state?.data?.session?.path === "/lobby");

// セッション一覧 / 終了
const list = await rpc("sessionHub_listSessions", undefined, ADMIN_TOKEN);
check("一覧に載る", list.some((s) => s.id === meta.id));
await rpc("sessionHub_closeSession", { sessionId: meta.id }, ADMIN_TOKEN);
await sleep(500);
check("終了が全端末へ通知され 4410 で切断", wsHost.messages.some((m) => m.closed === 4410) && wsClient2.messages.some((m) => m.t === "update" && m.result.session.status === "closed"));
try {
  await rpc("sessionHub_joinClient", { code: meta.code });
  check("終了後の参加は拒否", false);
} catch (e) {
  check("終了後の参加は拒否", /SESSION_NOT_FOUND/.test(e.message), e.message);
}

// ポーリング(フォールバック)RPC
const meta2 = await rpc("sessionHub_createSession", { name: "poll" }, ADMIN_TOKEN);
const c2 = await rpc("sessionHub_joinClient", { code: meta2.code });
const polled = await rpc("sessionHub_poll", { sessionId: meta2.id, deviceId: c2.deviceId, token: c2.token, sinceSeq: 0, stateVersion: 0 });
check("poll RPC(フォールバック)も DO 経由で動く", polled.session.id === meta2.id && polled.presence.clientCount === 1);

// 存在しないセッションへの WS
const ghost = await new Promise((resolve) => {
  const ws = new WebSocket(`${BASE.replace("http", "ws")}/ws/no-such-session`);
  ws.onopen = () => resolve("opened");
  ws.onerror = () => resolve("rejected");
  ws.onclose = () => resolve("rejected");
});
check("存在しないセッションへの WebSocket は拒否される(404)", ghost === "rejected", ghost);

for (const c of [wsHost, wsAdmin, wsClient2]) c.ws.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
