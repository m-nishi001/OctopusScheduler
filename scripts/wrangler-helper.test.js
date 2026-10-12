import assert from "node:assert/strict";
import test from "node:test";
import { wranglerCommand } from "./lib/wrangler.js";

test("wranglerCommand: wrangler が解決できれば node で直接起動する", () => {
  const [file, prefix] = wranglerCommand(() => "/x/wrangler/bin/wrangler.js");
  assert.equal(file, process.execPath);
  assert.deepEqual(prefix, ["/x/wrangler/bin/wrangler.js"]);
});

test("wranglerCommand: 解決できなければ npx にフォールバックする", () => {
  const [file, prefix] = wranglerCommand(() => {
    throw new Error("not found");
  });
  assert.equal(file, "npx");
  assert.deepEqual(prefix, ["-y", "wrangler@4"]);
});
