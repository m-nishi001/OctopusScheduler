import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import {
  buildContentEntries,
  buildJackpotAssets,
  buildJackpotRecord,
  buildPrizes,
  buildQuizAssets,
  blobHash,
  buildQuizRecord,
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

test("buildPrizes: 確変の画像1と画像2(と当選画像1・2)は別の素材で、中身も違う", () => {
  const { prizes, media } = buildJackpotRecord();
  for (const p of prizes) {
    assert.notEqual(p.image, p.image2, p.id);
    assert.notEqual(p.winningImage1, p.winningImage2, p.id);
    assert.notEqual(media[p.image].hash, media[p.image2].hash, `${p.id}: 画像1と画像2の中身が同じ`);
    assert.notEqual(media[p.winningImage1].hash, media[p.winningImage2].hash, `${p.id}: 当選画像1と2の中身が同じ`);
  }
});

test("buildContentEntries: 決定的で、キーが重複しない", () => {
  const a = buildContentEntries(1);
  const b = buildContentEntries(1);
  assert.deepEqual(a.map((e) => e[0]), b.map((e) => e[0]));
  assert.ok(a.every(([, v], i) => Buffer.compare(Buffer.from(v), Buffer.from(b[i][1])) === 0));
  assert.equal(new Set(a.map((e) => e[0])).size, a.length);
  assert.ok(a.length >= 20, "第三者がすぐ動かせる量のコンテンツがある");
});

test("buildContentEntries: アセットのIDに _ を含めない(キーの先頭の _ までをIDとして読むため)", () => {
  for (const [hash] of buildJackpotAssets()) assert.match(hash, /^[0-9a-f]{32}$/);
  for (const [hash] of buildQuizAssets()) assert.match(hash, /^[0-9a-f]{32}$/);
  for (const q of buildQuizzes()) assert.doesNotMatch(q.id, /_/);
});

test("buildQuizRecord: 正解番号が選択肢にあり、素材の名前にはすべて索引と対応するアセットがある。索引は参照されている名前だけ", () => {
  const hashes = new Set(buildQuizAssets().map(([hash]) => hash));
  const { quizzes, media } = buildQuizRecord();
  assert.ok(quizzes.length >= 5);
  const used = new Set();
  for (const q of quizzes) {
    assert.ok(q.options.some((o) => o.no === q.correctNo), q.id);
    const refs = [q.bgm, ...q.options.map((o) => o.image), q.settings?.prizeImage, q.settings?.prizeBgm].filter(Boolean);
    for (const name of refs) {
      used.add(name);
      assert.ok(media[name], `${q.id}: ${name}`);
      assert.ok(hashes.has(media[name].hash), `${q.id}: ${name}`);
    }
  }
  assert.deepEqual(new Set(Object.keys(media)), used);
});

test("buildJackpotRecord: 景品と画面設定が参照する素材の名前はすべて索引にあり、索引は参照されている名前だけ。ファイルはハッシュで保存される", () => {
  const { prizes, screens, media } = buildJackpotRecord();
  assert.ok(prizes.length >= 6);
  const used = new Set();
  for (const p of prizes) {
    for (const key of ["image", "image2", "bgm1", "bgm2", "winningImage1", "winningImage2"]) {
      assert.ok(media[p[key]], `${p.id}.${key}`);
      used.add(p[key]);
    }
    assert.ok(["roulette", "slot"].includes(p.animation));
  }
  assert.deepEqual(prizes.map((p) => p.order), prizes.map((_, i) => i + 1));

  assert.deepEqual(screens.map((s) => s.screenName).sort(), ["demo", "description", "ending", "main", "opening", "result"]);
  for (const s of screens) {
    assert.equal(typeof s.settingValue, "string");
    const v = JSON.parse(s.settingValue);
    const names = [v.bgm, v.demoBgm, v.demoSe1, v.resultBgm, v.resultSe1, ...(v.memberLotteryBgms ?? []), ...(v.contents ?? []).flatMap((c) => [c.media, c.se])].filter(Boolean);
    for (const name of names) {
      assert.ok(media[name], `${s.screenName}: ${name}`);
      used.add(name);
    }
  }
  assert.deepEqual(new Set(Object.keys(media)), used);

  const keys = buildContentEntries().map((e) => e[0]);
  for (const info of Object.values(media)) assert.ok(keys.includes(`jackpot-game/assets/${info.hash}_blob`));
});

test("buildContentEntries: Content-Type が付き、画像と音のMIMEが正しい", () => {
  for (const [key, value, type] of buildContentEntries()) {
    if (key.endsWith(".json")) assert.equal(type, "application/json");
    else if (value.subarray(0, 4).toString("ascii") === "RIFF") assert.equal(type, "audio/wav");
    else assert.equal(type, "image/png");
  }
  const keys = buildContentEntries().map((e) => e[0]);
  assert.ok(keys.includes("quiz-game/json/quiz-list.json"));
  assert.ok(keys.includes("jackpot-game/json/jackpot-config.json"));
});

test("buildContentEntries: 一覧のファイルは、アプリの同期が保存する { updatedAt, data } の形", () => {
  const entries = new Map(buildContentEntries(1234567890).map(([key, value]) => [key, value]));
  const quizzes = JSON.parse(entries.get("quiz-game/json/quiz-list.json"));
  const jackpot = JSON.parse(entries.get("jackpot-game/json/jackpot-config.json"));
  assert.equal(jackpot.updatedAt, 1234567890);
  assert.ok(jackpot.data.prizes.length > 0 && jackpot.data.screens.length > 0);
  assert.equal(quizzes.updatedAt, 1234567890);
  assert.deepEqual(quizzes.data, JSON.parse(JSON.stringify(buildQuizRecord())));
  assert.deepEqual(jackpot.data, JSON.parse(JSON.stringify(buildJackpotRecord())));
  // 更新日時を渡さなければ、いまの時刻(端末の古いデータより新しいものとして取り込まれる)
  const before = Date.now();
  const now = JSON.parse(new Map(buildContentEntries().map(([k, v]) => [k, v])).get("jackpot-game/json/jackpot-config.json")).updatedAt;
  assert.ok(now >= before);
});
