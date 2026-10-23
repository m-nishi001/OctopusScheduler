// 負荷テスト(フルコース): 参加者50人 + 運営(ホスト1・管理2)が同時に接続した状態で、本番と同じ順にイベントを通す。
//   ログインの殺到 → 入室 → イベント開始 → エントリー(全員一斉) → クイズ5問(一斉回答・選び直し・締切の競り合い・連打の嵐・手動締切)
//   → 全員の一斉再接続とホストのリロード → ジャックポット(停止操作の権限) → 結果の一斉取得 → エンディング・ロビー → セッション終了
// 画面は使わず、実際のクライアントと同じ RPC / WebSocket で動かす(DO と R2 にかかる負荷を再現するため)。
// 使い方は docs/load-test.md。BASE と E2E_ADMIN_TOKEN は scripts/e2e-local.js(npm run e2e -- load)か staging の出力が渡す。

import { Metrics } from "./lib/metrics.mjs";
import { Report } from "./lib/report.mjs";
import { rpc, RpcError } from "./lib/http.mjs";
import { HostOperator, Operator, RosterWatcher } from "./lib/operators.mjs";
import { createRng, Participant, readEvent, readQuiz, sleep } from "./lib/participant.mjs";
import { WsRejected } from "./lib/ws-client.mjs";

const int = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : Number.parseInt(v, 10);
};
const float = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : Number.parseFloat(v);
};

const cfg = {
  base: process.env.BASE ?? "http://127.0.0.1:8821",
  adminToken: process.env.E2E_ADMIN_TOKEN ?? "e2e-admin-session-token-0001",
  participants: int("LOAD_PARTICIPANTS", 50),
  /** 参加者のうち、WebSocket を使わずポーリングで動く端末の割合(電波・端末の事情でフォールバックする人)。 */
  pollRatio: float("LOAD_POLL_RATIO", 0.2),
  seed: int("LOAD_SEED", 20261018),
  reportPath: process.env.LOAD_REPORT ?? "",
  /** 合格基準。環境(ローカル / staging)に合わせて環境変数で調整できる。 */
  maxAnswerP95Ms: int("LOAD_MAX_ANSWER_P95_MS", 3_000),
  maxFanoutP95Ms: int("LOAD_MAX_FANOUT_P95_MS", 5_000),
  maxLoginFirstFailureRate: float("LOAD_MAX_LOGIN_FAILURE_RATE", 0.05),
};

const metrics = new Metrics();
const env = { base: cfg.base, metrics };
const report = new Report(metrics);
const rng = createRng(cfg.seed);
const rand = (min, max) => min + rng() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (list) => list[Math.floor(rng() * list.length)];
const runId = Date.now().toString(36).slice(-6);
const admin = (name, args) => rpc(env, name, args, cfg.adminToken);
const adminExpecting = (name, args, expect) => rpc(env, name, args, cfg.adminToken, { expect });

const COLORS = ["#ef4444", "#f59e0b", "#8b5cf6", "#3b82f6"];
const QUIZ_OPTIONS = [1, 2, 3, 4].map((no) => ({ no, text: `選択肢${no}`, color: COLORS[no - 1] }));

/** 同時に走らせる数を絞って順に流す(準備作業の管理者操作用)。 */
async function inChunks(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

/** 失敗しても数回やり直す(利用者が QR を読み直すのと同じ)。最後の失敗だけを本当のエラーとして数える。 */
async function withRetry(label, fn, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn({ soft: attempt < tries }, attempt);
    } catch (e) {
      if (attempt >= tries) throw e;
      metrics.count(`${label}:first-attempt-failed`);
      await sleep(400 * attempt + rand(0, 400));
    }
  }
}

/** 条件が満たされるまで待つ(満たされなければ false)。 */
async function waitUntil(predicate, timeoutMs, stepMs = 100) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(stepMs);
  }
  return predicate();
}

function fanoutMs(session, version, startedAt) {
  let at = Infinity;
  for (const [v, t] of session.arrivals) if (v >= version && t < at) at = t;
  return at === Infinity ? null : at - startedAt;
}

/** 公開した状態が、全員に届くまでの時間を測る。届かない端末は失敗として数える。 */
async function expectFanout(label, published, targets, { timeoutMs = 15_000 } = {}) {
  const missing = [];
  await Promise.all(
    targets.map(async (p) => {
      try {
        await p.session.waitFor((s) => s.stateVersion >= published.version, timeoutMs, `${label} v${published.version}`);
      } catch {
        missing.push(p.label);
      }
    })
  );
  for (const p of targets) {
    const ms = fanoutMs(p.session, published.version, published.startedAt);
    if (ms !== null) metrics.time(p.transport === "ws" ? `fanout:${label}` : `fanout-poll:${label}`, ms);
  }
  report.check(`状態「${label}」が全端末(${targets.length}台)に届く`, missing.length === 0, missing.length ? `届かない: ${missing.join(",")}` : "");
}

// ───────────────────────── 準備 ─────────────────────────

const participants = [];
let sessionId = "";
let host = null;
let admin1 = null;
let admin2 = null;
const memberIds = [];

async function setup() {
  const n = cfg.participants;
  const ids = Array.from({ length: n }, (_, i) => `ld-${runId}-${String(i + 1).padStart(2, "0")}`);
  const pollCount = Math.round(n * cfg.pollRatio);
  const created = await inChunks(ids, 10, async (id) => {
    await admin("accounts_addMember", { id, name: `負荷${id.slice(-2)}` });
    const { key } = await admin("accounts_issueLoginKey", { id });
    return { id, key };
  });
  created.forEach((c, i) => {
    memberIds.push(c.id);
    participants.push(
      new Participant(env, {
        index: i + 1,
        id: c.id,
        name: `負荷${c.id.slice(-2)}`,
        loginKey: c.key,
        // ポーリングの端末は後ろから割り当てる(先頭の参加者は WebSocket)
        transport: i >= n - pollCount ? "poll" : "ws",
      })
    );
  });
  report.check(`参加者 ${n} 人を用意(WebSocket ${n - pollCount} / ポーリング ${pollCount})`, participants.length === n);

  const meta = await admin("sessionHub_createSession", { name: `負荷試験 ${runId}` });
  sessionId = meta.id;
  await admin("sessionHub_setPortalSession", { sessionId, published: true });

  host = new HostOperator(env, cfg.adminToken, { label: "host", deviceId: `load-host-${runId}-0001` });
  admin1 = new Operator(env, cfg.adminToken, { role: "admin", label: "admin1", deviceId: `load-admin1-${runId}-01` });
  admin2 = new Operator(env, cfg.adminToken, { role: "admin", label: "admin2", deviceId: `load-admin2-${runId}-01` });
  for (const op of [host, admin1, admin2]) await op.join(sessionId);
  await Promise.all([host, admin1, admin2].map((op) => op.connect()));
  report.check("運営3端末(ホスト1・管理2)が接続", [host, admin1, admin2].every((op) => op.session.connected));
}

// ───────────────────────── 1. ログインと入室の殺到 ─────────────────────────

async function loginAndJoin() {
  const n = participants.length;
  const rampCount = Math.ceil(n * 0.2);
  const t0 = Date.now();
  await Promise.all(
    participants.map(async (p, i) => {
      // 前半の2割は少しずつ(開場直後)、残りは同時(QR が映った瞬間)
      if (i < rampCount) await sleep(i * 120);
      const started = Date.now();
      await withRetry("login", (o) => p.login(o));
      metrics.time("login", Date.now() - started);
    })
  );
  report.check(`${n} 人のログイン(受付QR)`, participants.every((p) => p.token), `${Date.now() - t0}ms`);
  const firstFailures = metrics.counters.get("login:first-attempt-failed") ?? 0;
  report.check(
    `ログインの初回失敗率が ${(cfg.maxLoginFirstFailureRate * 100).toFixed(0)}% 以下(同時 ${n - rampCount} 人の殺到を含む)`,
    firstFailures / n <= cfg.maxLoginFirstFailureRate,
    `${firstFailures}/${n}`
  );

  await Promise.all(
    participants.map(async (p) => {
      const started = Date.now();
      await withRetry("join", (o) => p.join(o));
      metrics.time("join", Date.now() - started);
    })
  );
  report.check(`${n} 人が入室`, participants.every((p) => p.device?.deviceId));

  await Promise.all(
    participants.map((p) =>
      withRetry("connect", async (_o, attempt) => {
        if (attempt > 1) p.session.close();
        await p.connect();
      })
    )
  );
  report.check(
    `${n} 人の接続と最初の状態の受信`,
    participants.every((p) => p.session.updates > 0),
    `WebSocket ${participants.filter((p) => p.transport === "ws").length} / ポーリング ${participants.filter((p) => p.transport === "poll").length}`
  );

  // 在席: 運営の2台と、ホストの画面に参加者数が反映される(在席は2秒ごとにまとめて配信)
  const seen = await Promise.all(
    [admin1, admin2, host].map((op) =>
      op.session
        .waitFor((s) => s.presence?.clientCount === n, 20_000, `参加者数 ${n}`)
        .then(() => true)
        .catch(() => false)
    )
  );
  report.check(`運営の全端末に参加者数 ${n} が反映`, seen.every(Boolean), `admin1 実測 ${admin1.session.presence?.clientCount}`);
  report.check("ホストと管理端末が在席として見える", !!admin1.session.presence?.host && admin1.session.presence.admins.length >= 2);
}

// ───────────────────────── 2. イベント開始とエントリー ─────────────────────────

let eventSlice = null;
let entryKey = "";

async function eventAndEntry() {
  const lobby = await host.publishSlice("session", { path: `/session/host/${sessionId}` });
  await expectFanout("ロビー表示", lobby, participants);

  // 管理端末のコマンドがホストに届く(WebSocket と RPC の両方)
  const beforeCommands = host.session.commands.length;
  const issued = await Promise.all([admin1.issue("event", "start", { title: "負荷試験イベント" }, { viaWs: true }), admin2.issue("event", "noop", undefined)]);
  await host.session.waitFor((s) => s.commands.length >= beforeCommands + 2, 10_000, "管理端末のコマンド").catch(() => undefined);
  report.check(
    "管理端末2台のコマンドがホストに届く",
    host.session.commands.length >= beforeCommands + 2 && issued.every((r) => r.seq > 0),
    `seq ${issued.map((r) => r.seq).join(",")}`
  );

  // ホストがイベントを公開(アプリの event-host と同じ形)
  const eventId = `ld${runId}`;
  entryKey = `entry:${eventId}`;
  eventSlice = { id: eventId, title: "負荷試験イベント", startedAtMs: Date.now(), pool: "entrants" };
  const started = await host.publishSlice("event", eventSlice);
  await expectFanout("イベント開始", started, participants);

  // エントリー受付を開く(オープン型・選択肢1つ)
  const opened = await host.openRound(entryKey, [{ no: 1, text: "エントリー" }], undefined, { mode: "open" });
  eventSlice = { ...eventSlice, entry: { key: entryKey, open: true } };
  const published = await host.publishSlice("event", eventSlice);
  report.check("エントリー受付が開く(運営が締めるまで開き続ける)", opened.deadlineMs - opened.serverNowMs > 60 * 60 * 1000);
  const watchers = [host, admin1, admin2].map((op) => new RosterWatcher(op, entryKey));

  // 全員が一斉にエントリー(同時にボタンを押す)。1割は二度押し。
  const results = await Promise.all(
    participants.map(async (p, i) => {
      const first = await p.enter(entryKey, randInt(0, 400));
      if (i % 10 === 0) await p.submit(entryKey, 1);
      return first;
    })
  );
  await expectFanout("エントリー受付", published, participants);
  report.check(
    `${participants.length} 人のエントリーが全員受理される`,
    results.every((r) => r.no === 1 && r.duplicate === false),
    `拒否 ${results.filter((r) => r.rejected).length}`
  );
  const doubleTapped = participants.filter((_, i) => i % 10 === 0);
  report.check("二度押しは重複として扱われ、人数は増えない", doubleTapped.every((p) => p.rounds.get(entryKey).responses.at(-1).duplicate === true));

  // 運営の一覧(回答数/更新番号の通知をきっかけに取得)に全員が載る
  await sleep(2_500);
  const answers = await admin1.getAnswers(entryKey);
  const entrants = new Set(answers.answers.map((a) => a.memberId));
  report.check(
    "エントリー一覧にログイン済みの全員が1件ずつ載る",
    answers.answers.length === participants.length && participants.every((p) => entrants.has(p.id)),
    `${answers.answers.length}件`
  );
  report.check("回答数が運営の全端末に届く", [host, admin1, admin2].every((op) => op.session.round?.answerCount === participants.length));
  for (const w of watchers) w.stop();
  const closed = await admin2.closeRound(entryKey);
  eventSlice = { ...eventSlice, entry: { key: entryKey, open: false } };
  await host.publishSlice("event", eventSlice);
  report.check("管理端末がエントリーを締め切れる(受付後も人数は変わらない)", closed.open === false && closed.answerCount === participants.length);
}

// ───────────────────────── 3. クイズ5問 ─────────────────────────

const quizResults = [];
let quizNumber = 0;

/**
 * 1問分: 出題 → 参加者の回答 → 締切 → 保存された内容の検証 → 正解発表 → 結果の保存。
 * plan(participant, index, ctx) は、その参加者の手順 [{ at: 絶対時刻(ms), no, window }] を返す。
 *   window: "open"(必ず受理される) | "race"(締切と競る。どちらでもよい) | "closed"(締切後。受理されてはいけない)
 */
async function quizRound(title, { plan, manualCloseAtMs = null, durationMs = 20_000 }) {
  const number = ++quizNumber;
  const key = `ld${runId}-q${number}:live`;
  const correctNo = randInt(1, 4);
  const t0 = Date.now();
  const opened = await host.openRound(key, QUIZ_OPTIONS.map(({ no, text }) => ({ no, text })), durationMs);
  const offsetMs = opened.serverNowMs - Date.now(); // サーバ時刻 - この端末の時刻(往復の遅れを含む近似)
  const deadlineLocal = opened.deadlineMs - offsetMs;
  const slice = {
    page: "play",
    title,
    roundKey: key,
    deadlineMs: opened.deadlineMs,
    phase: "answering",
    question: `${title}の問題です`,
    options: QUIZ_OPTIONS,
    correctNo: null,
  };
  const published = await host.publishSlice("quiz", slice);
  const watchers = [host, admin1, admin2].map((op) => new RosterWatcher(op, key));

  const ctx = { key, t0, deadlineLocal, openedAtMs: opened.serverNowMs };
  const closer =
    manualCloseAtMs === null
      ? Promise.resolve()
      : (async () => {
          await sleep(Math.max(0, t0 + manualCloseAtMs - Date.now()));
          const r = await admin1.closeRound(key);
          // 管理端末2台が同時に締めても問題ない(2回目は何もしない)
          await admin2.closeRound(key);
          report.check(`${title}: 手動で締め切ると受付が閉じる`, r.open === false);
        })();

  const planned = participants.map((p, i) => ({ p, steps: plan(p, i, ctx).sort((a, b) => a.at - b.at) }));
  // 参加者は出題を見てから、計画の時刻に回答を送る
  const outcomes = await Promise.all(
    planned.map(async ({ p, steps }) => {
      await p.session.waitFor((s) => readQuiz(s.data)?.roundKey === key, 20_000, `${title}の出題`);
      const done = [];
      for (const step of steps) {
        const wait = step.at - Date.now();
        if (wait > 0) await sleep(wait);
        const r = await p.submit(key, step.no);
        done.push({ ...step, ...r, sentAt: Date.now() });
      }
      return { p, steps: done };
    })
  );
  await closer;
  // 手動で締めない問題は、自動の締切(サーバ時刻)を待つ。ホストは何もしない。
  if (manualCloseAtMs === null) await sleep(Math.max(0, deadlineLocal - Date.now()) + 800);

  const final = await host.getAnswers(key);
  report.check(`${title}: 締切後は受付が閉じている(ホストが何もしなくても)`, final.round.open === false, `open=${final.round.open}`);

  // 運営の3端末が、最後の回答数・更新番号を受け取り、一覧も最新まで取り直す(通知は2秒ごとにまとめて届き、取得は1.5秒間隔)
  const signature = `${final.round.answerCount}:${final.round.answerRev}`;
  const settled = await waitUntil(
    () =>
      watchers.every((w) => w.lastSignature === signature && !w.timer && w.latest?.round.answerRev === final.round.answerRev && w.latest.answers.length === final.answers.length) &&
      [host, admin1, admin2].every((op) => op.session.round?.key === key && op.session.round.answerCount === final.round.answerCount && op.session.round.answerRev === final.round.answerRev),
    12_000
  );
  for (const w of watchers) w.stop();
  report.check(
    `${title}: 運営の全端末に最終の回答数・更新番号が届き、回答の一覧も最新になる`,
    settled,
    watchers.map((w) => `${w.lastSignature}/${w.latest?.answers.length ?? "-"}件`).join(" ")
  );

  // 検証1: 受付中に送った回答は全部受理され、締切後の試行は受理されない
  const mustSucceed = outcomes.flatMap(({ p, steps }) => steps.filter((s) => s.window === "open").map((s) => ({ p, s })));
  const failedEarly = mustSucceed.filter(({ s }) => s.rejected);
  report.check(`${title}: 受付中の回答(${mustSucceed.length}件)がすべて受理される`, failedEarly.length === 0, failedEarly.slice(0, 3).map(({ p, s }) => `${p.label}:${s.rejected}`).join(","));
  const mustBeClosed = outcomes.flatMap(({ p, steps }) => steps.filter((s) => s.window === "closed").map((s) => ({ p, s })));
  const acceptedLate = mustBeClosed.filter(({ s }) => !s.rejected && s.duplicate === false);
  report.check(
    `${title}: 締切後の回答(${mustBeClosed.length}件)は新たに採用されない`,
    acceptedLate.length === 0,
    acceptedLate.slice(0, 3).map(({ p }) => p.label).join(",")
  );

  // 検証2: 保存された回答は、各参加者が最後に受け取った応答と一致する(1人1件・最後の選択)
  const byMember = new Map(final.answers.map((a) => [a.memberId, a]));
  const answered = participants.filter((p) => p.finalResponse(key));
  report.check(`${title}: 回答した人数と保存された件数が一致`, final.answers.length === answered.length, `保存 ${final.answers.length} / 回答 ${answered.length}`);
  report.check(`${title}: 保存された回答は1人1件`, byMember.size === final.answers.length);
  const mismatched = answered.filter((p) => {
    const stored = byMember.get(p.id);
    const last = p.finalResponse(key);
    return !stored || stored.no !== last.no || stored.atMs !== last.atMs;
  });
  report.check(
    `${title}: 保存された選択肢・回答時刻が、各自が最後に受け取った応答と一致`,
    mismatched.length === 0,
    mismatched.slice(0, 3).map((p) => `${p.label}:${byMember.get(p.id)?.no}≠${p.finalResponse(key).no}`).join(",")
  );
  const intended = outcomes.filter(({ steps }) => steps.length && steps.every((s) => s.window === "open"));
  const lostChange = intended.filter(({ p, steps }) => byMember.get(p.id)?.no !== steps.at(-1).no);
  report.check(`${title}: 受付中に最後に選んだものが回答になる(${intended.length}人)`, lostChange.length === 0, lostChange.slice(0, 3).map(({ p }) => p.label).join(","));
  const outOfWindow = final.answers.filter((a) => a.atMs < opened.serverNowMs || a.atMs >= opened.deadlineMs);
  report.check(`${title}: 回答時刻はすべて受付の時間内`, outOfWindow.length === 0);

  // 検証3: 更新番号は「採用/置換された回数」と一致(選び直しが運営端末に伝わる仕組み)
  const accepted = participants.reduce((sum, p) => sum + (p.rounds.get(key)?.responses.filter((r) => r.duplicate === false).length ?? 0), 0);
  report.check(`${title}: 更新番号(answerRev)が採用・置換の回数 ${accepted} と一致`, final.round.answerRev === accepted, `answerRev=${final.round.answerRev}`);

  // 参加者は一覧を取得できない(回答の中身は運営だけ)
  const snoop = participants[0];
  const snoopResult = await rpc(env, "sessionHub_getAnswers", { sessionId, deviceId: snoop.device.deviceId, token: snoop.device.token, key }, null, { expect: ["FORBIDDEN"] }).then(
    () => "allowed",
    (e) => (e instanceof RpcError ? e.code : "error")
  );
  report.check(`${title}: 参加者は回答一覧を取得できない`, snoopResult === "FORBIDDEN", snoopResult);

  // 正解発表(全員に届く)
  const reveal = await host.publishSlice("quiz", { ...slice, page: "answer", phase: "closed", deadlineMs: null, correctNo });
  await expectFanout(`${title} 正解発表`, reveal, participants);

  // 結果の保存(R2)
  const correct = final.answers
    .filter((a) => a.no === correctNo)
    .sort((a, b) => a.atMs - b.atMs)
    .map((a) => ({ memberId: a.memberId, name: participants.find((p) => p.id === a.memberId)?.name ?? a.label, sec: Math.round(((a.atMs - opened.serverNowMs) / 1000) * 10) / 10 }));
  const correctIds = new Set(correct.map((c) => c.memberId));
  const result = {
    roundKey: key,
    quizId: `ld-q${number}`,
    title,
    correctNo,
    closedAtMs: Math.min(Date.now(), opened.deadlineMs),
    answeredCount: final.answers.length,
    correct,
    wrongMemberIds: final.answers.filter((a) => !correctIds.has(a.memberId)).map((a) => a.memberId),
  };
  await admin("sessionHub_putQuizResult", { sessionId, result });
  quizResults.push({ key, result, correctIds });
  await host.publishSlice("quiz", { ...slice, page: "result", phase: "closed", deadlineMs: null, correctNo });
  report.info(`${title}: 回答 ${final.answers.length} 件(採用/置換 ${accepted} 回)、正解者 ${correct.length} 人、締切まで ${Math.round((Date.now() - t0) / 1000)} 秒`);
}

const answersFor = (p) => pick([1, 2, 3, 4]);

async function quizRounds() {
  // 第1問: 開始と同時に全員が答える(最も負荷が高い瞬間)。2割は二度押し。
  await quizRound("第1問(一斉回答)", {
    durationMs: 10_000,
    plan: (p, i, c) => {
      const no = answersFor(p);
      const at = Date.now() + 300 + rand(0, 300);
      const steps = [{ at, no, window: "open" }];
      if (i % 5 === 0) steps.push({ at: at + 120, no, window: "open" });
      return steps;
    },
  });

  // 第2問: 回答がばらけ、選び直しが多い(6割が1回、2割が2回選び直す)。
  await quizRound("第2問(選び直し)", {
    plan: (p, i, c) => {
      let at = c.t0 + rand(500, 8_000);
      const steps = [{ at, no: answersFor(p), window: "open" }];
      const changes = i % 5 < 3 ? 1 : i % 5 === 3 ? 2 : 0;
      for (let k = 0; k < changes; k++) {
        at += rand(300, 3_000);
        let no = answersFor(p);
        while (no === steps.at(-1).no) no = answersFor(p);
        steps.push({ at, no, window: "open" });
      }
      return steps;
    },
  });

  // 第3問: 締切の直前まで回答が続く。ホストは何もしない(サーバ時刻で自動に締まる)。締切後の試行も混ぜる。
  await quizRound("第3問(締切の競り合い)", {
    plan: (p, i, c) => {
      const race = i % 3 === 0;
      const first = race ? c.deadlineLocal - rand(300, 1_200) : c.t0 + rand(1_000, c.deadlineLocal - c.t0 - 2_500);
      const steps = [{ at: first, no: answersFor(p), window: race ? "race" : "open" }];
      if (i % 4 === 0) {
        // 一度答えた人が締切の少し前に選び直す(「競り合い」)
        steps.push({ at: c.deadlineLocal - rand(100, 700), no: answersFor(p), window: "race" });
      }
      // 締切後に押してしまう人(締切を過ぎてから)
      if (i % 5 === 1) steps.push({ at: c.deadlineLocal + rand(1_200, 2_500), no: answersFor(p), window: "closed" });
      return steps;
    },
  });

  // 第4問: 連打と選び直しの嵐。全員が2秒のあいだに6回ずつ押し直す(DO への書き込みが最も集中する場面)。
  await quizRound("第4問(連打の嵐)", {
    durationMs: 10_000,
    plan: (p, i, c) => {
      const base = Date.now() + 400;
      const steps = [];
      let last = 0;
      for (let k = 0; k < 6; k++) {
        let no = answersFor(p);
        while (no === last) no = answersFor(p);
        last = no;
        steps.push({ at: base + rand(0, 2_000), no, window: "open" });
      }
      return steps;
    },
  });

  // 第5問: 管理端末が途中で手動締切。締切後の試行は受理されない。
  await quizRound("第5問(手動締切)", {
    manualCloseAtMs: 6_000,
    plan: (p, i, c) => {
      const early = i % 4 !== 3;
      const at = early ? c.t0 + rand(500, 3_800) : c.t0 + 8_500 + rand(0, 1_500);
      const steps = [{ at, no: answersFor(p), window: early ? "open" : "closed" }];
      if (early && i % 3 === 0) steps.push({ at: c.t0 + 4_500 + rand(0, 500), no: answersFor(p), window: "open" });
      return steps;
    },
  });
}

// ───────────────────────── 4. 一斉再接続とホストのリロード ─────────────────────────

async function reconnectStorm() {
  const n = participants.length;
  // 会場の Wi-Fi が一瞬切れて全員が切断 → その間にホストが状態を更新 → 全員が一斉に再接続して追いつく
  for (const p of participants) p.session.close();
  await sleep(300);
  const updated = await host.publishSlice("session", { path: "/execute/jackpot-draw" });
  const reconnectStarted = Date.now();
  await Promise.all(participants.map((p) => withRetry("reconnect", async () => p.session.reconnect())));
  metrics.time("reconnect:all", Date.now() - reconnectStarted);
  await expectFanout("切断中の更新(再接続で追いつく)", updated, participants);
  report.check(`${n} 人が一斉に再接続できる`, participants.every((p) => p.session.connected));
  const stale = participants.filter((p) => p.session.data.session?.path !== "/execute/jackpot-draw");
  report.check("再接続した全員が最新の画面状態になる", stale.length === 0, stale.slice(0, 3).map((p) => p.label).join(","));
  const counted = await admin1.session
    .waitFor((s) => s.presence?.clientCount === n, 20_000, `再接続後の参加者数 ${n}`)
    .then(() => true)
    .catch(() => false);
  report.check("再接続後も参加者数が増えも減りもしない(同じ端末として置き換わる)", counted, `実測 ${admin1.session.presence?.clientCount}`);

  // 同じ端末が二重に接続すると、古い接続は 4409 で切られる(WebSocket の参加者から1人)
  const dup = participants.find((p) => p.transport === "ws");
  const second = new (dup.session.constructor)(env, dup.session.identity);
  await second.connect();
  await dup.session.waitFor((s) => s.closeCode !== null, 5_000, "古い接続の切断").catch(() => undefined);
  report.check("同じ端末の二重接続では古い接続が 4409 で切られる", dup.session.closeCode === 4409, `closeCode=${dup.session.closeCode}`);
  second.close();
  await dup.session.reconnect();

  // ホストのリロード(接続を切って、同じ端末として再接続し、公開を続ける)
  host.close();
  await sleep(500);
  await host.session.reconnect();
  const afterReload = await host.publishSlice("session", { path: "/execute/jackpot-draw", reloaded: true });
  await expectFanout("ホストのリロード後の公開", afterReload, participants);
  report.check(
    "ホストのリロード後も、在席のホストが1台のまま",
    !!admin1.session.presence?.host && admin1.session.presence.host.deviceId === host.deviceId
  );
}

// ───────────────────────── 5. ジャックポット ─────────────────────────

const draws = [];

async function jackpot() {
  const winnersOrder = [participants[3], participants[participants.length - 2], participants[participants.length - 1]]; // WebSocket と ポーリング
  for (const [i, winner] of winnersOrder.entries()) {
    const stage = (name, extra = {}) => ({ page: "main-draw", stage: name, canStop: false, member: null, memberId: null, prize: null, ...extra });
    await host.publishSlice("jackpot", stage("member"));
    const revealed = await host.publishSlice("jackpot", stage("member-revealed", { member: winner.name, memberId: winner.id }));
    await expectFanout(`ジャックポット${i + 1} 当選者発表`, revealed, participants);
    // 景品抽選: 停止できるのは当選者だけ(サーバが強制する)
    const prize = await host.publishSlice(
      "jackpot",
      stage("prize", { canStop: true, member: winner.name, memberId: winner.id }),
      [{ key: "jackpot.stopRoulette", memberIds: [winner.id] }]
    );
    await expectFanout(`ジャックポット${i + 1} 景品抽選`, prize, participants);

    const others = participants.filter((p) => p !== winner).slice(0, 6);
    const attempts = await Promise.all(
      others.map((p) => p.session.issue("jackpot", "stopRoulette").then(() => "allowed", (e) => (e instanceof WsRejected ? e.code : `error:${e.message}`)))
    );
    report.check(`ジャックポット${i + 1}: 当選者以外の停止操作は拒否される`, attempts.every((a) => a === "FORBIDDEN"), attempts.join(","));
    const before = host.session.commands.length;
    const stop = await winner.session.issue("jackpot", "stopRoulette");
    await host.session.waitFor((s) => s.commands.length > before, 10_000, "当選者の停止操作").catch(() => undefined);
    const received = host.session.commands.slice(before).find((c) => c.type === "stopRoulette");
    report.check(`ジャックポット${i + 1}: 当選者の停止操作がホストに届く`, !!received && received.issuerRole === "client" && stop.seq > 0, `seq=${stop.seq}`);

    await host.publishSlice("jackpot", stage("prize-revealed", { member: winner.name, memberId: winner.id, prize: `景品${i + 1}` }), []);
    const draw = { drawId: `ld${runId}-d${i + 1}`, memberId: winner.id, memberName: winner.name, prizeId: `p${i + 1}`, prizeName: `景品${i + 1}`, isKakuhen: false, atMs: Date.now() };
    await admin("sessionHub_commitJackpotDraw", { sessionId, draw });
    await admin("sessionHub_revealJackpotDraw", { sessionId, drawId: draw.drawId });
    draws.push({ draw, winner });
  }
  await host.publishSlice("jackpot", { page: "main-draw", stage: "ended", canStop: false, member: null, memberId: null, prize: null });
}

// ───────────────────────── 6. 結果の一斉取得 ─────────────────────────

async function results() {
  const n = participants.length;
  const readAll = (label) =>
    Promise.all(
      participants.map(async (p) => {
        const started = Date.now();
        const view = await rpc(env, "sessionHub_getResults", { sessionId }, p.token);
        metrics.time(`results:${label}`, Date.now() - started);
        return { p, view };
      })
    );

  // 全員が同時に結果タブを開く。その間にも管理者が結果を書き続ける(同じ内容の再送と、新しい抽選結果)。
  const first = await readAll("初回");
  const rev = first[0].view.rev;
  report.check(`${n} 人が同時に結果を取得できる`, first.length === n && first.every((r) => r.view.rev === rev), `rev=${rev}`);
  const wrong = [];
  for (const { p, view } of first) {
    for (const { key, result, correctIds } of quizResults) {
      const round = view.quiz.rounds.find((r) => r.roundKey === key);
      const stored = result.correct.concat(result.wrongMemberIds.map((id) => ({ memberId: id }))).some((c) => c.memberId === p.id);
      const rank = round?.me.rank ?? null;
      const expectedRank = correctIds.has(p.id) ? result.correct.findIndex((c) => c.memberId === p.id) + 1 : null;
      if (!round || round.me.answered !== stored || round.me.correct !== correctIds.has(p.id) || rank !== expectedRank) wrong.push(`${p.label}:${key}`);
    }
  }
  report.check(`${n} 人それぞれの結果(回答済み・正誤・順位)が、保存した内容と一致(${quizResults.length}問)`, wrong.length === 0, wrong.slice(0, 3).join(","));
  const wins = first.filter(({ p, view }) => view.jackpot.myWins !== draws.filter((d) => d.winner === p).length);
  report.check("ジャックポットの当選回数が本人の分だけ正しく出る", wins.length === 0, wins.slice(0, 3).map(({ p }) => p.label).join(","));
  report.check("他の参加者の識別子(memberId)は結果に含まれない", first.every(({ view }) => !JSON.stringify(view).includes(memberIds[0])));

  const writer = (async () => {
    for (let k = 0; k < 5; k++) {
      await sleep(150);
      await Promise.all(quizResults.map(({ result }) => admin("sessionHub_putQuizResult", { sessionId, result })));
      const extra = { ...draws[0].draw, drawId: `ld${runId}-x${k}`, memberId: `ld${runId}-x${k}`, prizeId: `ld${runId}-xp${k}`, atMs: Date.now() };
      await admin("sessionHub_commitJackpotDraw", { sessionId, draw: extra });
      await admin("sessionHub_revealJackpotDraw", { sessionId, drawId: extra.drawId });
    }
  })();
  const second = await readAll("書き込み中");
  await writer;
  const third = await readAll("最終");
  const finalRev = third[0].view.rev;
  report.check(
    "書き込みと同時の取得でも版(rev)が巻き戻らず、最終の版は新しい抽選結果の数(5)だけ進む(同じ内容の再送では進まない)",
    second.every(({ view }) => view.rev >= rev) && third.every((r) => r.view.rev === finalRev) && finalRev === rev + 5,
    `rev ${rev} → ${finalRev}`
  );
  report.check("最終の取得に、書き込んだ抽選結果がすべて反映される", third.every((r) => r.view.jackpot.draws.length === draws.length + 5), `${third[0].view.jackpot.draws.length}件`);

  // 参加者は結果を書けない
  const forbidden = await rpc(env, "sessionHub_putQuizResult", { sessionId, result: quizResults[0].result }, participants[0].token, { expectMessage: /Unauthorized/ }).then(
    () => "allowed",
    (e) => (e instanceof RpcError ? "rejected" : "error")
  );
  report.check("参加者は結果を書けない", forbidden === "rejected", forbidden);
}

// ───────────────────────── 7. エンディングとロビー、終了 ─────────────────────────

async function endingAndClose() {
  await host.publishSlice("session", { path: "/jackpot-ending" });
  await host.publishSlice("jackpot", null);
  await admin1.issue("event", "end");
  // ホスト側の処理: エンディングを流し終えたらイベントを終えてロビーへ戻る
  const endedEvent = await host.publishSlice("event", null);
  const lobby = await host.publishSlice("session", { path: `/session/host/${sessionId}` });
  await expectFanout("イベント終了とロビー復帰", { version: Math.max(endedEvent.version, lobby.version), startedAt: endedEvent.startedAt }, participants);
  const lingering = participants.filter((p) => readEvent(p.session.data) !== null || p.session.data.jackpot !== undefined);
  report.check("イベント終了後、全員の画面からイベントとジャックポットの状態が消える", lingering.length === 0, lingering.slice(0, 3).map((p) => p.label).join(","));

  // セッション終了: 全端末に通知され、WebSocket は 4410 で閉じる。ポーリングの端末は終了を検知する。
  const started = Date.now();
  await admin("sessionHub_closeSession", { sessionId });
  const wsClients = participants.filter((p) => p.transport === "ws");
  await Promise.all(wsClients.map((p) => p.session.waitFor((s) => s.closeCode !== null, 15_000, "終了の通知").catch(() => undefined)));
  const pollClients = participants.filter((p) => p.transport === "poll");
  // ポーリングの端末は次の取得で終了を知る(取得間隔ぶん遅れる)
  await Promise.all(pollClients.map((p) => p.session.waitFor((s) => s.sessionInfo?.status === "closed", 15_000, "終了の検知").catch(() => undefined)));
  metrics.time("close:notify", Date.now() - started);
  report.check(
    `セッション終了が全端末に伝わる(WebSocket ${wsClients.length}台は 4410、ポーリング ${pollClients.length}台は closed)`,
    wsClients.every((p) => p.session.closeCode === 4410) && pollClients.every((p) => p.session.sessionInfo?.status === "closed"),
    `4410でない: ${wsClients.filter((p) => p.session.closeCode !== 4410).length}`
  );
  const rejoin = await rpc(env, "sessionHub_joinPortal", {}, participants[0].token, { expect: ["SESSION_NOT_FOUND"] }).then(
    () => "joined",
    (e) => (e instanceof RpcError ? e.code : "error")
  );
  report.check("終了後は参加できない", rejoin === "SESSION_NOT_FOUND", rejoin);
}

// ───────────────────────── 後片付けと判定 ─────────────────────────

async function cleanup() {
  for (const p of participants) p.close();
  for (const op of [host, admin1, admin2]) op?.close();
  if (sessionId) await rpc(env, "sessionHub_closeSession", { sessionId }, cfg.adminToken, { expect: ["SESSION_NOT_FOUND"] }).catch(() => undefined);
  await inChunks(memberIds, 10, (id) => rpc(env, "accounts_deleteMember", { id }, cfg.adminToken).catch(() => undefined));
}

function judge() {
  const answer = metrics.stats("ws:answer");
  report.gate("WebSocket の回答の応答 p95", answer?.p95 ?? null, cfg.maxAnswerP95Ms);
  const pollAnswer = metrics.stats("poll:answer");
  if (pollAnswer) report.gate("ポーリング端末(RPC)の回答の応答 p95", pollAnswer.p95, cfg.maxAnswerP95Ms);
  const fanouts = [...metrics.timings.keys()].filter((k) => k.startsWith("fanout:"));
  const all = fanouts.flatMap((k) => metrics.timings.get(k)).sort((a, b) => a - b);
  report.gate("状態の公開から WebSocket 端末に届くまで p95", all.length ? all[Math.min(all.length - 1, Math.ceil(all.length * 0.95) - 1)] : null, cfg.maxFanoutP95Ms);
  const counters = metrics.counters;
  // 無料枠の目安: 1日2回のイベントでも、Workers / Durable Objects のリクエスト(各 100,000/日)の 30% に収める
  // (packages/session-hub/src/shared/quota-budget.ts の FREE_TIER / BUDGET_RATIO / EXPECTED_LOAD.eventsPerDay と同じ前提)。
  // WebSocket は接続1回 = 1リクエスト、クライアントからの送信 20件 = 1リクエスト。
  const httpTotal = [...counters.entries()].filter(([k]) => /^http:\d+$/.test(k)).reduce((sum, [, v]) => sum + v, 0);
  const wsConnects = metrics.timings.get("ws:connect+auth")?.length ?? 0;
  const estimated = httpTotal + wsConnects + Math.ceil((counters.get("ws:messages-sent") ?? 0) / 20);
  report.check(`1イベントの課金対象リクエストの推定(HTTP ${httpTotal} + WebSocket接続 ${wsConnects} + 送信 ${counters.get("ws:messages-sent") ?? 0}件/20)が、無料枠の30%を2回分に収まる範囲`, estimated * 2 <= 100_000 * 0.3, `推定 ${estimated} 件 / イベント`);
  report.check("HTTP 429(レート制限)が出ていない", (counters.get("http:429") ?? 0) === 0, `${counters.get("http:429") ?? 0}件`);
  report.check(
    "HTTP 5xx が出ていない",
    [...counters.keys()].filter((k) => /^http:5\d\d$/.test(k)).every((k) => counters.get(k) === 0),
    [...counters.entries()].filter(([k]) => /^http:5\d\d$/.test(k)).map(([k, v]) => `${k}=${v}`).join(",")
  );
}

async function main() {
  console.log(`負荷テスト(フルコース): BASE=${cfg.base} 参加者=${cfg.participants} ポーリング割合=${cfg.pollRatio} seed=${cfg.seed}`);
  try {
    const ready = await report.phase("準備(参加者・セッション・運営端末)", setup);
    if (ready.ok) {
      const entered = await report.phase("1. ログインと入室の殺到", loginAndJoin);
      if (entered.ok) {
        await report.phase("2. イベント開始とエントリー受付", eventAndEntry);
        await report.phase("3. クイズ5問", quizRounds);
        await report.phase("4. 全員の一斉再接続とホストのリロード", reconnectStorm);
        await report.phase("5. ジャックポット", jackpot);
        await report.phase("6. 結果の一斉取得", results);
        await report.phase("7. エンディング・ロビー・セッション終了", endingAndClose);
      }
    }
  } finally {
    await report.phase("後片付け", cleanup);
  }
  judge();
  const ok = report.finish({ reportPath: cfg.reportPath, config: { ...cfg, adminToken: "(省略)" } });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
