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

// 回答ラウンド: ホストが開始 → 参加者が WebSocket で回答 → 回答数が alarm で運営端末へ → 締切 → 一覧
const options = [1, 2, 3].map((no) => ({ no, text: `選択肢${no}` }));
const round = await rpc("sessionHub_openRound", { sessionId: meta.id, ...creds(host), key: "q1:live", options, durationMs: 30000 });
check("ホストが回答ラウンドを開始(締切はサーバ時刻)", round.deadlineMs - round.serverNowMs === 30000);
wsClient.ws.send(JSON.stringify({ t: "answer", requestId: "ans-1", key: "q1:live", no: 2 }));
wsClient.ws.send(JSON.stringify({ t: "answer", requestId: "ans-2", key: "q1:live", no: 3 }));
await sleep(500);
check("参加者の回答(WS)が受理され、2回目は最初の回答のまま duplicate",
  wsClient.messages.some((m) => m.t === "answered" && m.requestId === "ans-1" && m.no === 2 && m.duplicate === false) &&
  wsClient.messages.some((m) => m.t === "answered" && m.requestId === "ans-2" && m.no === 2 && m.duplicate === true));
wsClient.ws.send(JSON.stringify({ t: "answer", requestId: "ans-bad", key: "q1:live", no: 9 }));
await sleep(300);
check("存在しない選択肢は rejected", wsClient.messages.some((m) => m.t === "rejected" && m.requestId === "ans-bad" && m.code === "INVALID_ARGUMENT"));
await sleep(2600);
const adminRound = wsAdmin.messages.filter((m) => m.t === "update").at(-1)?.result.round;
check("回答数が運営端末へまとめて届く(alarm)", adminRound?.answerCount === 1 && adminRound?.open === true, JSON.stringify(adminRound));
const clientRound = wsClient.messages.filter((m) => m.t === "update").at(-1)?.result.round;
check("参加者には回答数を渡さない", clientRound === null);
try {
  await rpc("sessionHub_getAnswers", { sessionId: meta.id, ...creds(client), key: "q1:live" });
  check("参加者は回答一覧を取得できない", false);
} catch (e) {
  check("参加者は回答一覧を取得できない", /FORBIDDEN/.test(e.message), e.message);
}
const closed = await rpc("sessionHub_closeRound", { sessionId: meta.id, ...creds(admin), key: "q1:live" });
check("管理端末が締め切れる", closed.open === false && closed.answerCount === 1);
wsClient.ws.send(JSON.stringify({ t: "answer", requestId: "ans-after", key: "q1:live", no: 1 }));
await sleep(300);
check("締切後でも回答済みの端末には最初の回答を返す(画面表示を揃える)",
  wsClient.messages.some((m) => m.t === "answered" && m.requestId === "ans-after" && m.no === 2 && m.duplicate === true));
const late = await rpc("sessionHub_joinClient", { code: meta.code, label: "遅刻" });
const wsLate = await connect(meta.id, creds(late));
wsLate.ws.send(JSON.stringify({ t: "answer", requestId: "ans-late", key: "q1:live", no: 1 }));
await sleep(300);
check("締切後に初めて回答する端末は ROUND_CLOSED", wsLate.messages.some((m) => m.t === "rejected" && m.requestId === "ans-late" && m.code === "ROUND_CLOSED"));
wsLate.ws.close();
const answers = await rpc("sessionHub_getAnswers", { sessionId: meta.id, ...creds(host), key: "q1:live" });
check("ホストが回答一覧を取得(永続化済み)", answers.answers.length === 1 && answers.answers[0].no === 2 && answers.answers[0].label === "太郎", JSON.stringify(answers.answers));

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
