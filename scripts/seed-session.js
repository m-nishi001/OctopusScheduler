/**
 * デプロイ済みの試験環境に、ポータル公開済みのセッションを用意する(第三者がログインしてすぐ参加できるように)。
 *
 * 管理者のセッショントークンで /rpc を呼ぶ。既に使えるセッション(同名・終了前)があれば作り直さず、ポータルに公開し直すだけ。
 * セッションの寿命は12時間なので、期限が切れたら `node scripts/staging.js seed` で作り直せる。
 */
import { buildPrizes } from "./seed-content.js";

export const DEFAULT_SESSION_NAME = "年末ジャックポット抽選会(試験環境)";

/** /rpc に渡す本文(e2e/ui/fixtures.ts の adminRpc と同じ形式)。 */
export function buildRpcBody(name, args, token) {
  return { name, args: { __octopusAuth: token, args } };
}

/** 一覧から、そのまま使える既存セッション(同名・終了前)を探す。新しいものを優先。 */
export function pickReusableSession(sessions, name) {
  return sessions
    .filter((s) => s.name === name && s.status !== "closed")
    .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
}

async function rpc({ fetch, baseUrl, token }, name, args) {
  const res = await fetch(`${baseUrl}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildRpcBody(name, args, token)),
  });
  const json = await res.json();
  if (json.status !== "success") throw new Error(`${name}: ${json.message}`);
  return json.data;
}

/** 失敗しても少し待って再試行する(デプロイ直後は反映待ちで落ちることがある)。 */
export async function withRetry(fn, { attempts = 5, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts) throw error;
      await sleep(2000 * i);
    }
  }
}

/** セッションを用意してポータルに公開する。`{ id, code, name, reused }` を返す。 */
export async function ensurePortalSession({ fetch = globalThis.fetch, baseUrl, token, name = DEFAULT_SESSION_NAME, sleep }) {
  const ctx = { fetch, baseUrl: baseUrl.replace(/\/$/, ""), token };
  const existing = pickReusableSession(await withRetry(() => rpc(ctx, "sessionHub_listSessions", undefined), { sleep }), name);
  const session = existing ?? (await withRetry(() => rpc(ctx, "sessionHub_createSession", { name, mode: "live" }), { sleep }));
  await withRetry(() => rpc(ctx, "sessionHub_setPortalSession", { sessionId: session.id, published: true }), { sleep });
  return { id: session.id, code: session.code, name: session.name, reused: Boolean(existing) };
}

// ---------- ポータルの「結果」に最初から見えるサンプル ----------

const DEMO_QUIZ_TITLES = ["(サンプル) オクトパス豆知識", "(サンプル) 暦のクイズ", "(サンプル) 果物クイズ"];

/** 参加者IDから、`テスト参加者NN` という表示名を作る(seed-test-data.js と同じ規則)。 */
const nameOf = (id) => `テスト参加者${id.replace(/^test-user-/, "")}`;

/**
 * 結果タブが最初から埋まって見えるよう、クイズ3ラウンドと抽選5件のサンプルを作る(純粋関数・決定的)。
 * 実際に出題した結果と混ざらないよう、ラウンドキー・抽選IDは `seed-demo-` で始める。
 */
export function buildDemoResults(participantIds, now) {
  const ids = participantIds.slice(0, 20);
  const rounds = DEMO_QUIZ_TITLES.map((title, index) => {
    const r = index + 1;
    const answered = ids.map((id, i) => ({ id, i })).filter(({ i }) => (i + r) % 5 !== 0);
    const withResult = answered.map(({ id, i }) => ({ id, correct: (i * 5 + r * 2) % 7 < 4, sec: Math.round((1 + ((i * 7 + r * 3) % 40) / 4) * 10) / 10 }));
    const correct = withResult.filter((a) => a.correct).sort((a, b) => a.sec - b.sec || a.id.localeCompare(b.id));
    return {
      roundKey: `seed-demo-quiz-${r}`,
      quizId: `seed-quiz-${r}`,
      title,
      correctNo: 2,
      closedAtMs: now - (DEMO_QUIZ_TITLES.length - index) * 10 * 60_000,
      answeredCount: withResult.length,
      correct: correct.map((a) => ({ memberId: a.id, name: nameOf(a.id), sec: a.sec })),
      wrongMemberIds: withResult.filter((a) => !a.correct).map((a) => a.id),
    };
  });

  const prizes = buildPrizes();
  const winners = [3, 8, 13, 1, 16].filter((n) => n <= ids.length).map((n) => ids[n - 1]);
  const draws = winners.map((memberId, d) => ({
    drawId: `seed-demo-draw-${d + 1}`,
    memberId,
    memberName: nameOf(memberId),
    prizeId: prizes[Math.min(prizes.length - 1, 5 - d)].id,
    prizeName: prizes[Math.min(prizes.length - 1, 5 - d)].name,
    isKakuhen: d === 2,
    atMs: now - (winners.length - d) * 3 * 60_000,
  }));
  return { rounds, draws };
}

/** サンプルの結果を保存する。同じ ID で何度流しても増えない。保存したラウンド数・抽選数を返す。 */
export async function seedDemoResults({ fetch = globalThis.fetch, baseUrl, token, sessionId, participantIds, now = Date.now(), sleep }) {
  const ctx = { fetch, baseUrl: baseUrl.replace(/\/$/, ""), token };
  const { rounds, draws } = buildDemoResults(participantIds, now);
  for (const result of rounds) await withRetry(() => rpc(ctx, "sessionHub_putQuizResult", { sessionId, result }), { sleep });
  for (const draw of draws) await withRetry(() => rpc(ctx, "sessionHub_putJackpotDraw", { sessionId, draw }), { sleep });
  return { rounds: rounds.length, draws: draws.length };
}
