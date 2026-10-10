#!/usr/bin/env node
/**
 * ローカル(`wrangler dev --local`)の R2 に管理者アカウントとログイン済みセッションを投入する。
 *
 * アプリ全体が管理者ログイン必須で、worktree ごとにローカルの D1/R2 も別れるため、
 * 開発・UI テストで毎回手作業のログインを避けるための**ローカル専用**ツール。リモート(--remote)は対象外。
 *
 * 使い方:
 *   node scripts/seed-local-admin.js --config <wrangler.toml> [--persist-to <dir>]
 *     環境変数: SEED_ADMIN_ID(既定 admin) / SEED_ADMIN_NAME / SEED_ADMIN_PASSWORD / SEED_SESSION_TOKEN
 *
 * 保存形式は packages/accounts/src/server/accounts-use-cases.ts と
 * packages/infrastructures/src/cloudflare/cloudflare-password-hasher.ts(PBKDF2-SHA256, 100000回)に合わせる。
 */
import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SCALAR_PREFIX = "__scalars__/";
const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password, salt) {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256").toString("hex");
}

/** R2 に書くべき [キー, 値] の一覧を組み立てる(純粋関数。テスト対象)。 */
export function buildSeedEntries({ id, name, password, token, now, existingMembers = [] }) {
  if (!id || !password || !token) throw new Error("id / password / token are required");
  if (password.length < 8) throw new Error("password must be at least 8 characters");
  const salt = randomUUID();
  const members = [...existingMembers.filter((m) => m.id !== id), { id, name, isAdmin: true }];
  return [
    [`${SCALAR_PREFIX}member-directory-members`, JSON.stringify(members)],
    [`${SCALAR_PREFIX}accounts-credential/${id}`, JSON.stringify({ salt, hash: hashPassword(password, salt) })],
    [`${SCALAR_PREFIX}accounts-session/${token}`, JSON.stringify({ memberId: id, expiresAt: now + SESSION_TTL_MS })],
  ];
}

export function parseBucketName(toml) {
  const m = toml.match(/\[\[r2_buckets\]\][^[]*?bucket_name\s*=\s*"([^"]+)"/s);
  if (!m) throw new Error("wrangler.toml に r2_buckets の bucket_name が見つかりません");
  return m[1];
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1];
  return out;
}

function wrangler(args, { quiet = false } = {}) {
  return execFileSync("npx", ["-y", "wrangler@4", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", quiet ? "pipe" : "inherit"],
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = args.config;
  if (!config) throw new Error("--config <wrangler.toml> が必要です");
  const persist = args["persist-to"] ? ["--persist-to", args["persist-to"]] : [];
  const bucket = parseBucketName(readFileSync(config, "utf8"));
  const id = process.env.SEED_ADMIN_ID ?? "admin";
  const token = process.env.SEED_SESSION_TOKEN ?? randomUUID();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "local-dev-password";

  // 既存の名簿は保つ(2回目以降の実行で他メンバーを消さない)
  let existingMembers = [];
  try {
    const dir = mkdtempSync(join(tmpdir(), "seed-admin-"));
    const out = join(dir, "members.json");
    wrangler(["r2", "object", "get", `${bucket}/${SCALAR_PREFIX}member-directory-members`, "--file", out, "--local", "--config", config, ...persist], { quiet: true });
    existingMembers = JSON.parse(readFileSync(out, "utf8"));
  } catch {
    existingMembers = [];
  }

  const entries = buildSeedEntries({
    id,
    name: process.env.SEED_ADMIN_NAME ?? "Local Admin",
    password,
    token,
    now: Date.now(),
    existingMembers,
  });
  const dir = mkdtempSync(join(tmpdir(), "seed-admin-"));
  entries.forEach(([key, value], i) => {
    const file = join(dir, `entry-${i}.json`);
    writeFileSync(file, value);
    wrangler(["r2", "object", "put", `${bucket}/${key}`, "--file", file, "--local", "--config", config, ...persist]);
  });
  console.log(JSON.stringify({ adminId: id, password, sessionToken: token }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
