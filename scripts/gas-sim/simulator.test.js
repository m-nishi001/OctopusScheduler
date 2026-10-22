import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startSimulator, THROTTLE_MESSAGE, TIMEOUT_MESSAGE, renderPage } from "./simulator.js";
import { SimState, LOCK_TIMEOUT_MESSAGE } from "./state.js";
import { gasHashPassword, seedAdmin } from "./seed.js";

/** シミュレーターの検証用に、GAS の API を直接使う小さなサーバーバンドル(本物の dist/gas/server.js の代わり)。 */
const FAKE_SERVER = `
"use strict";
function ping(a) { return JSON.stringify({ status: "success", data: a }); }
function props() { return PropertiesService.getScriptProperties(); }
function lockedIncr() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var n = Number(props().getProperty("n") || 0);
    Utilities.sleep(40);
    props().setProperty("n", String(n + 1));
  } finally { lock.releaseLock(); }
  return "ok";
}
function unlockedIncr() {
  var n = Number(props().getProperty("n") || 0);
  Utilities.sleep(40);
  props().setProperty("n", String(n + 1));
  return "ok";
}
function holdLockForever() { LockService.getScriptLock().waitLock(1000); Utilities.sleep(200); return "held"; }
function tryLockTimeout() {
  try { LockService.getScriptLock().waitLock(60); return "acquired"; } catch (e) { return e.message; }
}
function bigProperty() { try { props().setProperty("big", "x".repeat(10000)); return "saved"; } catch (e) { return e.message; } }
function fillProperties() {
  for (var i = 0; i < 100; i++) {
    try { props().setProperty("fill-" + i, "y".repeat(9000)); } catch (e) { return JSON.stringify({ at: i, message: e.message }); }
  }
  return JSON.stringify({ at: -1 });
}
function bigCache() { try { CacheService.getScriptCache().put("k", "z".repeat(100 * 1024 + 1), 60); return "saved"; } catch (e) { return e.message; } }
function cacheRoundTrip(ttl) {
  var c = CacheService.getScriptCache();
  c.put("a", "v", ttl);
  return JSON.stringify([c.get("a"), c.get("missing")]);
}
function globalsProbe() {
  return JSON.stringify(["setTimeout", "setInterval", "crypto", "structuredClone", "TextEncoder", "URL", "queueMicrotask", "fetch", "Buffer", "process"].map(function (n) { return typeof globalThis[n]; }));
}
function freshGlobals() { globalThis.counter = (globalThis.counter || 0) + 1; return String(globalThis.counter); }
function spin() { for (;;) {} }
function hmac() {
  var signed = Utilities.computeHmacSha256Signature("message", "key");
  var mixed;
  try { Utilities.computeHmacSha256Signature("message", Utilities.newBlob("key").getBytes()); mixed = "no error"; } catch (e) { mixed = e.message; }
  return JSON.stringify({ signed: signed, mixed: mixed, hasNegative: signed.some(function (b) { return b < 0; }), isArray: signed instanceof Array });
}
function drive() {
  var root = DriveApp.getFolderById(props().getProperty("OCTOPUS_ROOT_FOLDER_ID"));
  var a = root.createFolder("dup");
  var b = root.createFolder("dup");
  var it = root.getFoldersByName("dup"), n = 0;
  while (it.hasNext()) { it.next(); n++; }
  var file = a.createFile(Utilities.newBlob("hello", "text/plain", "f.txt"));
  file.setContent("hello world");
  var text = a.getFilesByName("f.txt").next().getBlob().getDataAsString();
  var bytes = a.getFilesByName("f.txt").next().getBlob().getBytes();
  file.setTrashed(true);
  var afterTrash = a.getFilesByName("f.txt").hasNext();
  var missing;
  try { DriveApp.getFolderById("nope"); missing = "no error"; } catch (e) { missing = e.message; }
  return JSON.stringify({ duplicates: n, text: text, bytes: bytes.length, afterTrash: afterTrash, missing: missing, differentIds: a.getId() !== b.getId() });
}
function sheets() { try { SpreadsheetApp.openById("x"); return "no error"; } catch (e) { return e.message; } }
function doGet() { return HtmlService.createTemplateFromFile("index").evaluate().setTitle("Sim").addMetaTag("viewport", "width=device-width"); }
async function asyncPing(a) { return JSON.stringify({ status: "success", data: a }); }
`;

let dir;
before(() => {
  dir = mkdtempSync(join(tmpdir(), "gas-sim-test-"));
  writeFileSync(join(dir, "server.js"), FAKE_SERVER);
  writeFileSync(join(dir, "index.html"), "<!doctype html><html><head><title>x</title></head><body>hello</body></html>");
});
after(() => rmSync(dir, { recursive: true, force: true }));

/** 検証用サーバーでシミュレーターを起動し、終わったら止める。 */
async function withSim(options, fn) {
  const state = new SimState();
  state.setProperty("OCTOPUS_ROOT_FOLDER_ID", state.rootFolderId);
  const sim = await startSimulator({ serverPath: join(dir, "server.js"), htmlDir: dir, latencyMs: 0, concurrency: 4, state, ...options });
  try {
    await fn(sim);
  } finally {
    await sim.close();
  }
}

const value = async (sim, fn, arg) => {
  const out = await sim.invoke(fn, arg);
  assert.ok(out.ok, `${fn}: ${out.message}`);
  return out.result.value;
};

test("関数を呼べる(async も待つ)。存在しない関数と例外は失敗になる", () =>
  withSim({}, async (sim) => {
    assert.equal(await value(sim, "ping", { a: 1 }), '{"status":"success","data":{"a":1}}');
    assert.equal(await value(sim, "asyncPing", 2), '{"status":"success","data":2}');
    const missing = await sim.invoke("noSuchFunction");
    assert.equal(missing.ok, false);
    assert.match(missing.message, /Script function not found/);
  }));

test("ロック: waitLock は本物と同様にブロックし、更新が直列になる(ロック無しだと更新が失われる)", () =>
  withSim({ concurrency: 8 }, async (sim) => {
    const n = 8;
    await Promise.all(Array.from({ length: n }, () => value(sim, "lockedIncr")));
    assert.equal(sim.state.getProperty("n"), String(n));
    assert.ok(sim.state.stats.lockWaits > 0, "待ちが発生している");

    sim.state.deleteProperty("n");
    await Promise.all(Array.from({ length: n }, () => value(sim, "unlockedIncr")));
    assert.ok(Number(sim.state.getProperty("n")) < n, `ロック無しの競合が再現される(n=${sim.state.getProperty("n")})`);
  }));

test("ロック: 取れなければ timeout の例外。実行が終わればロックは自動で解放される", () =>
  withSim({}, async (sim) => {
    const holder = value(sim, "holdLockForever");
    await new Promise((r) => setTimeout(r, 80)); // holder がロックを取るのを待つ
    assert.equal(await value(sim, "tryLockTimeout"), LOCK_TIMEOUT_MESSAGE);
    assert.equal(await holder, "held"); // releaseLock せずに終わった
    assert.equal(await value(sim, "tryLockTimeout"), "acquired");
  }));

test("スロットリング: 同時実行の上限を超えた呼び出しは 'Service invoked too many times in a short time' で失敗する", () =>
  withSim({ concurrency: 2, latencyMs: 150 }, async (sim) => {
    const results = await Promise.all(Array.from({ length: 5 }, () => sim.invoke("ping", 1)));
    const throttled = results.filter((r) => !r.ok);
    assert.equal(results.filter((r) => r.ok).length, 2);
    assert.equal(throttled.length, 3);
    for (const r of throttled) assert.ok(r.message.includes(THROTTLE_MESSAGE));
    // 空けば通る(クライアントの再試行が通る)
    assert.ok((await sim.invoke("ping", 1)).ok);
    // HTTP では 429 + クライアントが判定に使うメッセージ
    const http = await Promise.all(Array.from({ length: 4 }, () => fetch(`${sim.url}/rpc`, { method: "POST", body: JSON.stringify({ name: "ping", args: 1 }) })));
    const limited = http.filter((r) => r.status === 429);
    assert.ok(limited.length >= 2);
    assert.match((await limited[0].json()).message, new RegExp(THROTTLE_MESSAGE));
  }));

test("容量: 1 値 9KB を超える保存は、gas-key-value-storage が拾う文言(quota / exceed / limit)の例外になる", () =>
  withSim({}, async (sim) => {
    assert.match(await value(sim, "bigProperty"), /quota|exceed|limit/i);
    assert.equal(sim.state.getProperty("big"), null);
  }));

test("容量: 合計 約500KB を超えると quota の例外になる", () =>
  withSim({}, async (sim) => {
    const r = JSON.parse(await value(sim, "fillProperties"));
    assert.ok(r.at > 40 && r.at < 60, `約 500KB / 9KB ≒ 55 件目で失敗する(at=${r.at})`);
    assert.match(r.message, /quota|exceed|limit/i);
    assert.ok(sim.state.propertiesBytes() <= 500 * 1024);
  }));

test("キャッシュ: 100KB を超える値は拒否し、TTL を過ぎると消える", async () => {
  let now = 1_000_000;
  const state = new SimState({ now: () => now });
  state.cachePut("a", "v", 10);
  assert.equal(state.cacheGet("a"), "v");
  now += 9_999;
  assert.equal(state.cacheGet("a"), "v");
  now += 2;
  assert.equal(state.cacheGet("a"), null);
  assert.throws(() => state.cachePut("big", "z".repeat(100 * 1024 + 1), 10), /too large/);
  assert.throws(() => state.cachePut("k".repeat(251), "v", 10), /too large/);
  state.cachePut("max", "v", 999_999); // 最大 6 時間に丸める
  now += 21_600_000 + 1;
  assert.equal(state.cacheGet("max"), null);
  await withSim({}, async (sim) => {
    assert.match(await value(sim, "bigCache"), /too large/);
    assert.deepEqual(JSON.parse(await value(sim, "cacheRoundTrip", 60)), ["v", null]);
  });
});

test("GAS に無いグローバル(setTimeout / crypto / structuredClone / TextEncoder / URL ...)は定義されていない", () =>
  withSim({}, async (sim) => {
    const types = JSON.parse(await value(sim, "globalsProbe"));
    assert.deepEqual(types, Array(types.length).fill("undefined"));
  }));

test("実行ごとにグローバルはまっさら(前の実行の変数は残らない)", () =>
  withSim({ concurrency: 1 }, async (sim) => {
    assert.equal(await value(sim, "freshGlobals"), "1");
    assert.equal(await value(sim, "freshGlobals"), "1");
  }));

test("SpreadsheetApp / FormApp は呼ぶと例外(このアプリでは使わない)", () =>
  withSim({}, async (sim) => {
    assert.match(await value(sim, "sheets"), /not available in the GAS simulator/);
  }));

test("Utilities: HMAC-SHA256 は符号付きバイトの配列を返し、string と byte[] の混在は拒否する", () =>
  withSim({}, async (sim) => {
    const r = JSON.parse(await value(sim, "hmac"));
    assert.equal(r.signed.length, 32);
    assert.ok(r.signed.every((b) => b >= -128 && b <= 127));
    assert.equal(r.hasNegative, true);
    assert.equal(r.isArray, true, "配列は実行のコンテキストの中で作られる(instanceof Array が真)");
    assert.match(r.mixed, /must match/);
  }));

test("シード: GasPasswordHasher と同じ計算(HMAC-SHA256 500 回)", () => {
  // 手計算できないので、定義どおりの別実装と突き合わせる
  const salt = "salt";
  let d = createHmac("sha256", salt).update("pw").digest();
  for (let i = 1; i < 500; i++) d = createHmac("sha256", Buffer.from(salt)).update(d).digest();
  assert.equal(gasHashPassword("pw", salt), d.toString("hex"));
  const state = new SimState();
  seedAdmin(state, { id: "admin", password: "pw-12345678", token: "tok" });
  assert.ok(state.getProperty("accounts-session/tok"));
  assert.equal(state.getProperty("OCTOPUS_ROOT_FOLDER_ID"), state.rootFolderId);
});

test("Drive: 同名フォルダの重複を許し、ゴミ箱のファイルは一覧に出ず、存在しない ID は例外", () =>
  withSim({}, async (sim) => {
    const r = JSON.parse(await value(sim, "drive"));
    assert.deepEqual(r, { duplicates: 2, text: "hello world", bytes: 11, afterTrash: false, missing: r.missing, differentIds: true });
    assert.match(r.missing, /No item with the given ID/);
  }));

test("実行時間の上限: 超えた実行は打ち切られ、ワーカーは作り直されて使い続けられる", () =>
  withSim({ concurrency: 1, execLimitMs: 300 }, async (sim) => {
    const out = await sim.invoke("spin");
    assert.equal(out.ok, false);
    assert.equal(out.message, TIMEOUT_MESSAGE);
    assert.equal(sim.stats.timeouts, 1);
    assert.equal(await value(sim, "ping", 1), '{"status":"success","data":1}');
  }));

test("HTTP: GET / は doGet の結果に偽の google.script.run を注入して返し、/rpc は戻り値の文字列を返す", () =>
  withSim({}, async (sim) => {
    const html = await (await fetch(`${sim.url}/`)).text();
    assert.match(html, /<title>Sim<\/title>/);
    assert.match(html, /name="viewport" content="width=device-width"/);
    assert.match(html, /window\.google = /);
    assert.ok(html.indexOf("window.google") < html.indexOf("hello"), "アプリのスクリプトより前に注入される");
    const res = await fetch(`${sim.url}/rpc`, { method: "POST", body: JSON.stringify({ name: "ping", args: "x" }) });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "success", data: "x" });
    const bad = await fetch(`${sim.url}/rpc`, { method: "POST", body: JSON.stringify({ name: "nope" }) });
    assert.equal(bad.status, 500);
    assert.equal((await bad.json()).status, "error");
  }));

test("遅延: 各呼び出しに設定した遅延が(ゆらぎつきで)足される", () =>
  withSim({ latencyMs: 200 }, async (sim) => {
    const t = Date.now();
    await value(sim, "ping", 1);
    const took = Date.now() - t;
    assert.ok(took >= 140, `遅延が足されている(${took}ms)`);
  }));

test("renderPage: <head> が無い HTML でも先頭に注入する", () => {
  assert.match(renderPage("<body>x</body>", "", []), /^<script>/);
});
