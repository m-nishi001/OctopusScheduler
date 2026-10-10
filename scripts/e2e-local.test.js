import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { freePort, renderLocalToml } from "./e2e-local.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("renderLocalToml: プレースホルダを残さず、パスを絶対パスにし、DOのバインディングを保つ", () => {
  const toml = renderLocalToml(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8"));
  // コメント中の説明文(REPLACE_WITH_*)ではなく、値としてのプレースホルダが残っていないこと
  assert.doesNotMatch(toml, /=\s*"REPLACE_WITH_/);
  assert.match(toml, /^main = "\/.*dist\/cloudflare\/worker\.js"$/m);
  assert.match(toml, /^directory = "\/.*dist\/cloudflare\/assets"$/m);
  assert.match(toml, /^migrations_dir = "\/.*packages\/infrastructures\/migrations"$/m);
  assert.match(toml, /database_id = "00000000-0000-0000-0000-000000000000"/);
  assert.match(toml, /name = "SESSION_ROOM"/);
  assert.match(toml, /new_sqlite_classes = \["SessionRoom"\]/);
});

test("renderLocalToml: 実在のリソースIDや認証情報を含まない(公開リポジトリ)", () => {
  const toml = renderLocalToml(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8"));
  assert.doesNotMatch(toml, /account_id|api_token/i);
});

test("freePort: 使用可能なポート番号を返す", async () => {
  const port = await freePort();
  assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
});
