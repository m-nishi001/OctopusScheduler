import { test } from "node:test";
import assert from "node:assert/strict";
import { appModeDefine, loadAppMode, parseAppMode } from "./app-mode.js";

test("parseAppMode: 有効な値を返す", () => {
  assert.equal(parseAppMode('{"mode":"development"}'), "development");
  assert.equal(parseAppMode('{"mode":"production"}'), "production");
});

test("parseAppMode: 不正な値/JSONはエラー(暗黙のデフォルトなし)", () => {
  assert.throws(() => parseAppMode("{}"), /must be one of/);
  assert.throws(() => parseAppMode('{"mode":"staging"}'), /must be one of/);
  assert.throws(() => parseAppMode("nope"), /not valid JSON/);
});

test("リポジトリの app-mode.config.json は読める", () => {
  assert.ok(["development", "production"].includes(loadAppMode()));
  assert.match(appModeDefine().__APP_MODE__, /^"(development|production)"$/);
});
