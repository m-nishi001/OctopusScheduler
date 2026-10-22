/**
 * シミュレーターの共有状態に、GAS 方式で管理者アカウントとログイン済みセッションを投入する。
 *
 * 保存形式は packages/accounts/src/server/accounts-use-cases.ts と
 * packages/infrastructures/src/gas/gas-password-hasher.ts(HMAC-SHA256 を 500 回)に合わせる。
 * GAS ではキーがそのまま ScriptProperties のキーになる(Cloudflare 版の `__scalars__/` は付かない)。
 * 保存先ルート(OCTOPUS_ROOT_FOLDER_ID)は、シミュレーターの Drive のルートフォルダを指す。
 */
import { createHmac, randomUUID } from "node:crypto";

const ROUNDS = 500;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ROOT_FOLDER_PROPERTY_KEY = "OCTOPUS_ROOT_FOLDER_ID";

/** GasPasswordHasher と同じ計算(Utilities.computeHmacSha256Signature の繰り返し)。 */
export function gasHashPassword(password, salt) {
  const saltBytes = Buffer.from(salt, "utf8");
  let digest = createHmac("sha256", saltBytes).update(Buffer.from(password, "utf8")).digest();
  for (let i = 1; i < ROUNDS; i++) digest = createHmac("sha256", saltBytes).update(digest).digest();
  return digest.toString("hex");
}

/** @param {import("./state.js").SimState} state */
export function seedAdmin(state, { id, name = "Local Admin", password, token, now = Date.now() }) {
  if (!id || !password || !token) throw new Error("id / password / token are required");
  const salt = randomUUID();
  state.setProperty(ROOT_FOLDER_PROPERTY_KEY, state.rootFolderId);
  state.setProperty("member-directory-members", JSON.stringify([{ id, name, isAdmin: true }]));
  state.setProperty(`accounts-credential/${id}`, JSON.stringify({ salt, hash: gasHashPassword(password, salt) }));
  state.setProperty(`accounts-session/${token}`, JSON.stringify({ memberId: id, expiresAt: now + SESSION_TTL_MS }));
}
