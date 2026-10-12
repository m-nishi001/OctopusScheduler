#!/usr/bin/env node
/**
 * 通しの動作確認用に、架空のテストデータ(管理者1名 + 参加者メンバー N 名 + クイズ・景品・画面設定・画像/音)を R2 に投入する。
 *
 * - ローカル(`wrangler dev --local` の永続領域)が既定。`--remote` で Cloudflare 上の試験環境(staging)にも入れられる。
 * - 決定的(同じ入力なら同じ ID・名前・ソルト)で冪等。2回流しても名簿が増えない。既存の他メンバーは残す。
 * - 公開リポジトリ向けの注意: ID・名前は架空のみ。パスワードはコードに持たず、環境変数で渡すか、
 *   指定が無ければ実行ごとにランダム生成して標準出力に出す(`--remote` では固定値を使わない)。
 *
 * 使い方:
 *   node scripts/seed-test-data.js --config <wrangler.toml> [--persist-to <dir>] [--remote] [--count 20]
 *     環境変数: SEED_ADMIN_ID(既定 admin) / SEED_ADMIN_PASSWORD / SEED_PARTICIPANT_PASSWORD / SEED_SESSION_TOKEN
 *   標準出力に JSON(管理者ID・パスワード、参加者ID一覧・パスワード・受付QRのログインキー、管理者セッショントークン)を出す。
 *
 * 保存形式は seed-local-admin.js(= accounts-use-cases.ts / cloudflare-password-hasher.ts)と同じ。
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildContentEntries } from "./seed-content.js";
import { buildSeedEntries, hashPassword, parseBucketName, wrangler } from "./seed-local-admin.js";

const SCALAR_PREFIX = "__scalars__/";
export const DEFAULT_COUNT = 20;
export const MAX_COUNT = 200;

/** 架空の参加者メンバー(`test-user-01`…)。 */
export function buildTestMembers(count = DEFAULT_COUNT) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`--count は 1〜${MAX_COUNT} の整数にしてください`);
  }
  const width = Math.max(2, String(count).length);
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(width, "0");
    return { id: `test-user-${n}`, name: `テスト参加者${n}` };
  });
}

/** ID から決まるソルト(冪等にするため。パスワードの強度には影響しない)。 */
export function deterministicSalt(id) {
  return createHash("sha256").update(`octopus-test-data:${id}`).digest("hex").slice(0, 32);
}

/**
 * ローカル用の決定的なログインキー(受付QRのキー)。架空IDから作るだけで、本物の資格情報ではない。
 * Cloudflare 上(`--remote`)では使わず、実行ごとにランダム生成する。
 */
export function deriveLoginKey(id) {
  return createHash("sha256").update(`octopus-test-login-key:${id}`).digest("hex");
}

/** 既存の名簿に、テスト参加者を足す(同じ ID は置き換え、それ以外は残す)。 */
export function mergeMembers(existing, testMembers) {
  const ids = new Set(testMembers.map((m) => m.id));
  return [...existing.filter((m) => !ids.has(m.id)), ...testMembers];
}

/** R2 に書くべき [キー, 値] の一覧を組み立てる(純粋関数。テスト対象)。 */
export function buildTestDataEntries({ count = DEFAULT_COUNT, admin, participantPassword, loginKeys, token, now, existingMembers = [] }) {
  if (!participantPassword || participantPassword.length < 8) throw new Error("participantPassword must be at least 8 characters");
  const participants = buildTestMembers(count);
  const keyOf = (id) => loginKeys?.[id] ?? deriveLoginKey(id);
  const entries = buildSeedEntries({
    id: admin.id,
    name: admin.name,
    password: admin.password,
    token,
    now,
    existingMembers: mergeMembers(existingMembers, participants),
  });
  for (const m of participants) {
    const salt = deterministicSalt(m.id);
    entries.push([`${SCALAR_PREFIX}accounts-credential/${m.id}`, JSON.stringify({ salt, hash: hashPassword(participantPassword, salt) })]);
    // 受付QR用のログインキー(accounts-use-cases.ts の issueLoginKey と同じ保存形式)
    entries.push([`${SCALAR_PREFIX}accounts-login-key/${m.id}`, JSON.stringify({ salt, hash: hashPassword(keyOf(m.id), salt) })]);
  }
  return entries;
}

const DEFAULT_CONTENT_TYPE = "application/json";
export const BULK_CONCURRENCY = 20;

/** エントリ([キー, 値, Content-Type?])を Content-Type ごとにまとめる(bulk put は1回の指定が1種類のため)。 */
export function groupByContentType(entries) {
  const groups = new Map();
  for (const [key, value, contentType = DEFAULT_CONTENT_TYPE] of entries) {
    if (!groups.has(contentType)) groups.set(contentType, []);
    groups.get(contentType).push([key, value]);
  }
  return groups;
}

/** `wrangler r2 bulk put` に渡す [{key, file}] を作る。ファイル名は連番(キーに / が含まれるため)。 */
export function buildBulkManifest(pairs, dir, prefix = "entry") {
  return pairs.map(([key], i) => ({ key, file: join(dir, `${prefix}-${i}`) }));
}

/** 全エントリを Content-Type ごとに1回の `r2 bulk put`(同時 BULK_CONCURRENCY 件)で書き込む。 */
function putAll({ entries, bucket, target, persist, config, dir }) {
  let n = 0;
  for (const [contentType, pairs] of groupByContentType(entries)) {
    const manifest = buildBulkManifest(pairs, dir, `g${n}`);
    pairs.forEach(([, value], i) => writeFileSync(manifest[i].file, value));
    const manifestFile = join(dir, `manifest-${n++}.json`);
    writeFileSync(manifestFile, JSON.stringify(manifest));
    wrangler(
      ["r2", "bulk", "put", bucket, "--filename", manifestFile, "--content-type", contentType, "--concurrency", String(BULK_CONCURRENCY), "--force", ...target, "--config", config, ...persist],
      { quiet: true }
    );
  }
}

export function parseArgs(argv) {
  const out = { remote: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    if (key === "remote") out.remote = true;
    else out[key] = argv[++i];
  }
  return out;
}

function randomPassword() {
  return randomBytes(12).toString("base64url");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.config) throw new Error("--config <wrangler.toml> が必要です");
  const count = args.count === undefined ? DEFAULT_COUNT : Number(args.count);
  const target = args.remote ? ["--remote"] : ["--local"];
  const persist = !args.remote && args["persist-to"] ? ["--persist-to", args["persist-to"]] : [];
  const bucket = parseBucketName(readFileSync(args.config, "utf8"));

  const admin = {
    id: process.env.SEED_ADMIN_ID ?? "admin",
    name: "テスト管理者",
    password: process.env.SEED_ADMIN_PASSWORD ?? (args.remote ? randomPassword() : "local-dev-password"),
  };
  const participantPassword = process.env.SEED_PARTICIPANT_PASSWORD ?? (args.remote ? randomPassword() : "local-dev-password");
  const token = process.env.SEED_SESSION_TOKEN ?? randomUUID();

  let existingMembers = [];
  try {
    const out = join(mkdtempSync(join(tmpdir(), "seed-test-")), "members.json");
    wrangler(["r2", "object", "get", `${bucket}/${SCALAR_PREFIX}member-directory-members`, "--file", out, ...target, "--config", args.config, ...persist], { quiet: true });
    existingMembers = JSON.parse(readFileSync(out, "utf8"));
  } catch {
    existingMembers = [];
  }

  // ローカルは決定的なキー、リモートは実行ごとのランダム(公開リポジトリの既知値を本物の環境に使わない)
  const loginKeys = Object.fromEntries(
    buildTestMembers(count).map((m) => [m.id, args.remote ? randomBytes(32).toString("hex") : deriveLoginKey(m.id)])
  );
  const entries = [
    ...buildTestDataEntries({ count, admin, participantPassword, loginKeys, token, now: Date.now(), existingMembers }),
    ...buildContentEntries(),
  ];
  putAll({ entries, bucket, target, persist, config: args.config, dir: mkdtempSync(join(tmpdir(), "seed-test-")) });

  console.log(
    JSON.stringify(
      {
        admin: { id: admin.id, password: admin.password, sessionToken: token },
        participants: { ids: buildTestMembers(count).map((m) => m.id), password: participantPassword, loginKeys },
      },
      null,
      2
    )
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
