/**
 * デプロイ済みの試験環境に、ポータル公開済みのセッションを用意する(第三者がログインしてすぐ参加できるように)。
 *
 * 管理者のセッショントークンで /rpc を呼ぶ。既に使えるセッション(同名・終了前)があれば作り直さず、ポータルに公開し直すだけ。
 * セッションの寿命は12時間なので、期限が切れたら `node scripts/staging.js seed` で作り直せる。
 */
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
