#!/usr/bin/env node
/**
 * 通しの動作確認用に、架空のテストデータ(管理者1名 + 参加者メンバー N 名)を R2 に投入する。
 *
 * - ローカル(`wrangler dev --local` の永続領域)が既定。`--remote` で Cloudflare 上の試験環境(staging)にも入れられる。
 * - 決定的(同じ入力なら同じ ID・名前・ソルト)で冪等。2回流しても名簿が増えない。既存の他メンバーは残す。
 * - 公開リポジトリ向けの注意: ID・名前は架空のみ。パスワードはコードに持たず、環境変数で渡すか、
 *   指定が無ければ実行ごとにランダム生成して標準出力に出す(`--remote` では固定値を使わない)。
 *
 * 使い方:
 *   node scripts/seed-test-data.js --config <wrangler.toml> [--persist-to <dir>] [--remote] [--count 20]
 *     環境変数: SEED_ADMIN_ID(既定 admin) / SEED_ADMIN_PASSWORD / SEED_PARTICIPANT_PASSWORD / SEED_SESSION_TOKEN
 *   標準出力に JSON(管理者ID・パスワード、参加者ID一覧・パスワード、管理者セッショントークン)を出す。
 *
 * 保存形式は seed-local-admin.js(= accounts-use-cases.ts / cloudflare-password-hasher.ts)と同じ。
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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

/** 既存の名簿に、テスト参加者を足す(同じ ID は置き換え、それ以外は残す)。 */
export function mergeMembers(existing, testMembers) {
  const ids = new Set(testMembers.map((m) => m.id));
  return [...existing.filter((m) => !ids.has(m.id)), ...testMembers];
}

/** R2 に書くべき [キー, 値] の一覧を組み立てる(純粋関数。テスト対象)。 */
export function buildTestDataEntries({ count = DEFAULT_COUNT, admin, participantPassword, token, now, existingMembers = [] }) {
  if (!participantPassword || participantPassword.length < 8) throw new Error("participantPassword must be at least 8 characters");
  const participants = buildTestMembers(count);
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
  }
  return entries;
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

  const entries = buildTestDataEntries({ count, admin, participantPassword, token, now: Date.now(), existingMembers });
  const dir = mkdtempSync(join(tmpdir(), "seed-test-"));
  entries.forEach(([key, value], i) => {
    const file = join(dir, `entry-${i}.json`);
    writeFileSync(file, value);
    wrangler(["r2", "object", "put", `${bucket}/${key}`, "--file", file, ...target, "--config", args.config, ...persist], { quiet: true });
  });

  console.log(
    JSON.stringify(
      {
        admin: { id: admin.id, password: admin.password, sessionToken: token },
        participants: { ids: buildTestMembers(count).map((m) => m.id), password: participantPassword },
      },
      null,
      2
    )
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
