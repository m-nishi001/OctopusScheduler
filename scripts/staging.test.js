import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertNotProduction, parseDeployUrl, renderUpSummary, STAGING, toStagingTemplate } from "./staging.js";

const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../wrangler.example.toml"), "utf8");

test("toStagingTemplate: Worker 名とレート制限の namespace_id を本番と分ける", () => {
  const out = toStagingTemplate(template);
  assert.match(out, /^name = "octopus-scheduler-staging"$/m);
  assert.ok(!out.includes('namespace_id = "1001"') && !out.includes('namespace_id = "1002"'));
  assert.ok(out.includes('namespace_id = "2001"') && out.includes('namespace_id = "2002"'));
});

test("toStagingTemplate: プレースホルダと Durable Object の設定は残す", () => {
  const out = toStagingTemplate(template);
  assert.match(out, /REPLACE_WITH_YOUR_D1_DATABASE_ID/);
  assert.match(out, /SESSION_ROOM/);
  assert.match(out, /new_sqlite_classes/);
});

test("assertNotProduction: staging の名前は通り、本番と同じ名前は拒否する", () => {
  assert.doesNotThrow(() => assertNotProduction(STAGING));
  assert.throws(() => assertNotProduction({ ...STAGING, bucket: "octopus-scheduler-assets" }));
  assert.throws(() => assertNotProduction({ ...STAGING, workerName: "octopus-scheduler" }));
});

test("parseDeployUrl: デプロイ出力から workers.dev の URL を取り出す", () => {
  const out = "Uploaded octopus-scheduler-staging\nDeployed octopus-scheduler-staging triggers\n  https://octopus-scheduler-staging.example-sub.workers.dev\nCurrent Version ID: x";
  assert.equal(parseDeployUrl(out), "https://octopus-scheduler-staging.example-sub.workers.dev");
  assert.equal(parseDeployUrl("no url"), null);
});

test("renderUpSummary: Playwright を向けるコマンドと撤去の案内を含む", () => {
  const text = renderUpSummary({
    url: "https://x.workers.dev",
    seed: { admin: { id: "admin", password: "pw", sessionToken: "tok" }, participants: { ids: ["test-user-01", "test-user-20"], password: "pu" } },
  });
  assert.match(text, /BASE=https:\/\/x\.workers\.dev/);
  assert.match(text, /E2E_ADMIN_TOKEN=tok/);
  assert.match(text, /staging:down/);
});
