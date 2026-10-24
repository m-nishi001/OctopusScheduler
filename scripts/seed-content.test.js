import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import {
  buildContentEntries,
  buildJackpotAssets,
  buildPrizes,
  buildQuizAssets,
  buildQuizzes,
  buildScreenSettings,
  makePng,
  makeWav,
} from "./seed-content.js";

test("makePng: PNG として読めるヘッダ・サイズ・画素を持つ", () => {
  const png = makePng(4, 2, (x, y) => [x * 10, y * 20, 7]);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), 4);
  assert.equal(png.readUInt32BE(20), 2);
  // IDAT を展開すると 行ごとの [フィルタ0, RGB...] になっている
  const idatLen = png.readUInt32BE(33);
  const raw = inflateSync(png.subarray(41, 41 + idatLen));
  assert.equal(raw.length, (4 * 3 + 1) * 2);
  assert.deepEqual([...raw.subarray(0, 7)], [0, 0, 0, 7, 10, 0, 7]);
});

test("makePng: 各チャンクのCRCが正しい", () => {
  const png = makePng(3, 3, () => [1, 2, 3]);
  let pos = 8;
  let chunks = 0;
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const body = png.subarray(pos + 4, pos + 8 + len);
    const stored = png.readUInt32BE(pos + 8 + len);
    let c = 0xffffffff;
    for (const b of body) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    assert.equal((c ^ 0xffffffff) >>> 0, stored);
    pos += 12 + len;
    chunks++;
  }
  assert.equal(chunks, 3);
});

test("makeWav: RIFF/WAVE のヘッダとデータ長が合う", () => {
  const wav = makeWav([[440, 0.1], [0, 0.05]]);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt32LE(24), 8000);
  const dataLen = wav.readUInt32LE(40);
  assert.equal(dataLen, 800 + 400);
  assert.equal(wav.length, 44 + dataLen);
  assert.equal(wav.readUInt32LE(4), 36 + dataLen);
});

test("buildPrizes: 確変の画像1と画像2(と当選画像1・2)は別のアセットで、中身も違う", () => {
  const assets = new Map(buildJackpotAssets().map(([id, , , body]) => [id, body]));
  for (const p of buildPrizes()) {
    assert.notEqual(p.imageAssetId, p.image2AssetId, p.id);
    assert.notEqual(p.winningImage1AssetId, p.winningImage2AssetId, p.id);
    assert.ok(!assets.get(p.imageAssetId).equals(assets.get(p.image2AssetId)), `${p.id}: 画像1と画像2の中身が同じ`);
    assert.ok(!assets.get(p.winningImage1AssetId).equals(assets.get(p.winningImage2AssetId)), `${p.id}: 当選画像1と2の中身が同じ`);
  }
});

test("buildContentEntries: 決定的で、キーが重複しない", () => {
  const a = buildContentEntries();
  const b = buildContentEntries();
  assert.deepEqual(a.map((e) => e[0]), b.map((e) => e[0]));
  assert.ok(a.every(([, v], i) => Buffer.compare(Buffer.from(v), Buffer.from(b[i][1])) === 0));
  assert.equal(new Set(a.map((e) => e[0])).size, a.length);
  assert.ok(a.length >= 20, "第三者がすぐ動かせる量のコンテンツがある");
});

test("buildContentEntries: アセットのIDに _ を含めない(キーの先頭の _ までをIDとして読むため)", () => {
  for (const [id] of buildJackpotAssets()) assert.doesNotMatch(id, /_/);
  for (const [slotId] of buildQuizAssets()) assert.doesNotMatch(slotId, /_/);
  for (const q of buildQuizzes()) assert.doesNotMatch(q.id, /_/);
});

test("buildQuizzes: 正解番号が選択肢にあり、drive: 参照にはすべて対応するアセットがある", () => {
  const slots = new Set(buildQuizAssets().map(([s]) => s));
  const quizzes = buildQuizzes();
  assert.ok(quizzes.length >= 5);
  for (const q of quizzes) {
    assert.ok(q.options.some((o) => o.no === q.correctNo), q.id);
    const refs = [q.bgm, ...q.options.map((o) => o.image), q.settings?.prizeImageDataUrl, q.settings?.prizeBgmDataUrl].filter(Boolean);
    for (const ref of refs) assert.ok(slots.has(ref.replace(/^drive:/, "")), `${q.id}: ${ref}`);
  }
});

test("buildPrizes / buildScreenSettings: 参照するアセットがすべて存在する", () => {
  const assetIds = new Set(buildJackpotAssets().map(([id]) => id));
  const prizes = buildPrizes();
  assert.ok(prizes.length >= 6);
  for (const p of prizes) {
    for (const key of ["imageAssetId", "image2AssetId", "bgm1AssetId", "bgm2AssetId", "winningImage1AssetId", "winningImage2AssetId"]) assert.ok(assetIds.has(p[key]), `${p.id}.${key}`);
    assert.ok(["roulette", "slot"].includes(p.animation));
  }
  assert.deepEqual(prizes.map((p) => p.order), prizes.map((_, i) => i + 1));

  const screens = buildScreenSettings();
  assert.deepEqual(
    screens.map((s) => s.screenName).sort(),
    ["demo", "description", "ending", "main", "opening", "result"]
  );
  for (const s of screens) {
    assert.equal(typeof s.settingValue, "string");
    const v = JSON.parse(s.settingValue);
    const ids = [v.bgmAssetId, v.descriptionBgm, v.demoBgm, v.demoSe1, v.resultBgm, v.resultSe1, ...(v.memberLotteryBgms ?? []), ...(v.contents ?? []).flatMap((c) => [c.assetId, c.seAssetId])].filter(Boolean);
    for (const id of ids) assert.ok(assetIds.has(id), `${s.screenName}: ${id}`);
  }
});

test("buildContentEntries: Content-Type が付き、画像と音のMIMEが正しい", () => {
  for (const [key, value, type] of buildContentEntries()) {
    if (key.endsWith(".json")) assert.equal(type, "application/json");
    else if (value.subarray(0, 4).toString("ascii") === "RIFF") assert.equal(type, "audio/wav");
    else assert.equal(type, "image/png");
  }
  const keys = buildContentEntries().map((e) => e[0]);
  assert.ok(keys.includes("quiz-game/json/quizzes.json"));
  assert.ok(keys.includes("jackpot-game/json/prizes.json"));
  assert.ok(keys.includes("jackpot-game/json/screens.json"));
});
