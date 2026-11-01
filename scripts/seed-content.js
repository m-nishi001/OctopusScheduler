/**
 * 試験環境(staging / dev:stack)に入れる、クイズ・ジャックポットの架空コンテンツ。
 *
 * 画像(PNG)と音(WAV)はこのファイルで生成する(ネットワーク不要・著作権の問題なし・決定的)。
 * R2 のキー・保存形式は実アプリの同期処理に合わせてある:
 *   - クイズ一覧         quiz-game/json/quiz-list.json    ({ updatedAt, data: { quizzes, media } }、画像・音声は素材の名前で参照し、media が 名前 → ハッシュ・MIME・サイズ)
 *   - クイズのアセット   quiz-game/assets/<ハッシュ>_blob  (ハッシュ = 中身の SHA-256 の先頭32桁。アプリの hashBlob と同じ)
 *   - ジャックポット     jackpot-game/json/jackpot-config.json ({ updatedAt, data: { prizes, screens, media } }。景品と画面設定(settingValue は JSON 文字列)は素材の名前で参照し、media が 名前 → ハッシュ・MIME・サイズ)
 *   - ジャックポットの素材 jackpot-game/assets/<ハッシュ>_blob  (ハッシュ = 中身の SHA-256 の先頭32桁。アプリの hashBlob と同じ)
 * 一覧のファイルは、アプリの同期が保存する `{ updatedAt, data }` の形(updatedAt はミリ秒)。端末が持つ同じ種類のデータより新しければ、取り込まれる。
 */
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

const JSON_TYPE = "application/json";
const PNG_TYPE = "image/png";
const WAV_TYPE = "audio/wav";

// ---------- 画像・音の生成 ----------

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** `pixel(x, y)` が [r, g, b] を返す RGB の PNG を作る(純粋関数)。 */
export function makePng(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // フィルタなし
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** 斜めのグラデーション + 中央の光る円。景品やクイズ選択肢の仮画像。 */
export function makeBadgePng(c1, c2, { width = 96, height = 96 } = {}) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const radius = Math.min(width, height) * 0.32;
  return makePng(width, height, (x, y) => {
    const base = mix(a, b, (x / width + y / height) / 2);
    const d = Math.hypot(x - cx, y - cy);
    if (d < radius) return mix(base, [255, 255, 255], 0.75);
    if (d < radius + 3) return mix(base, [255, 255, 255], 0.35);
    return base;
  });
}

/** HSL(色相0-360・彩度/明度0-1)を #rrggbb にする。 */
function hslToHex(h, sat, light) {
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 参加者の顔写真(架空)。番号ごとに色の違う円つきの正方形 PNG。名簿の `photo` はこの内容の SHA-256 先頭16桁で、
 * 保存先のキーは accounts/assets/<ハッシュ>_photo.png(実アプリの putMemberPhoto と同じ)。
 */
export function buildMemberPhoto(index) {
  const hue = (index * 47) % 360;
  const body = makeBadgePng(hslToHex(hue, 0.7, 0.55), hslToHex((hue + 40) % 360, 0.65, 0.3), { width: 128, height: 128 });
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
  return { hash, key: `accounts/assets/${hash}_photo.png`, body, mime: PNG_TYPE };
}

/** 8bit・8kHz・モノラルの WAV を、(周波数Hz, 秒) の並びから作る(矩形波に近い柔らかい音)。0Hz は無音。 */
export function makeWav(notes, { sampleRate = 8000, volume = 0.35 } = {}) {
  const samples = [];
  for (const [freq, seconds] of notes) {
    const n = Math.round(seconds * sampleRate);
    for (let i = 0; i < n; i++) {
      const fade = Math.min(1, i / 80, (n - i) / 80); // プチッというノイズを防ぐ
      const wave = freq === 0 ? 0 : Math.sin((2 * Math.PI * freq * i) / sampleRate) + 0.3 * Math.sin((4 * Math.PI * freq * i) / sampleRate);
      samples.push(Math.max(0, Math.min(255, Math.round(128 + wave * 90 * volume * 2 * fade))));
    }
  }
  const data = Buffer.from(samples);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // モノラル
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const NOTE = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, E5: 659, G5: 784 };
const tune = (names, seconds) => names.map((n) => (n === "-" ? [0, seconds] : [NOTE[n], seconds]));

export const TUNES = {
  opening: tune(["C4", "E4", "G4", "C5", "G4", "E4", "C4", "-", "D4", "F4", "A4", "C5", "A4", "F4", "D4", "-"], 0.18),
  draw: tune(["C5", "G4", "E4", "G4", "C5", "E5", "C5", "G4", "A4", "F4", "D4", "F4", "A4", "C5", "A4", "F4"], 0.14),
  ending: tune(["G4", "E4", "C4", "-", "E4", "G4", "C5", "-", "G4", "E4", "D4", "C4"], 0.24),
  fanfare: tune(["C5", "C5", "C5", "G5"], 0.12),
  quiz: tune(["E4", "G4", "B4", "G4", "E4", "G4", "B4", "E5"], 0.2),
  prize: tune(["C5", "E5", "G5", "E5", "G5", "C5", "G5"], 0.16),
};

// ---------- ジャックポット ----------

const PRIZE_DEFS = [
  { id: "seed-prize-1", name: "1等 ペア旅行券", weight: 3, animation: "roulette", colors: ["#f59e0b", "#b45309"] },
  { id: "seed-prize-2", name: "2等 最新ワイヤレスイヤホン", weight: 8, animation: "slot", colors: ["#3b82f6", "#1e3a8a"] },
  { id: "seed-prize-3", name: "3等 高級和牛セット", weight: 15, animation: "roulette", colors: ["#ef4444", "#7f1d1d"] },
  { id: "seed-prize-4", name: "4等 ギフトカード 5,000円", weight: 25, animation: "slot", colors: ["#10b981", "#064e3b"] },
  { id: "seed-prize-5", name: "5等 人気スイーツ詰め合わせ", weight: 35, animation: "roulette", colors: ["#ec4899", "#831843"] },
  { id: "seed-prize-6", name: "参加賞 オリジナルタンブラー", weight: 50, animation: "slot", colors: ["#8b5cf6", "#4c1d95"] },
];

/** 景品の画像の素材の名前。1 が通常の画像、2 が確変の 2 回目に出す画像。 */
const prizeImageName = (p, n) => (n === 1 ? `${p.id}.png` : `${p.id}-2.png`);

/** ジャックポットが参照する画像・音声。素材の名前(ファイル名)→ `[MIME, 中身]`。同じ名前は同じ素材として1つ(索引もファイルも1つ)。 */
function jackpotMediaFiles() {
  const files = new Map();
  for (const p of PRIZE_DEFS) {
    files.set(prizeImageName(p, 1), [PNG_TYPE, makeBadgePng(...p.colors)]);
    // 確変の「画像2」。画像1と見て区別できるよう、色を反転させる。
    files.set(prizeImageName(p, 2), [PNG_TYPE, makeBadgePng(p.colors[1], p.colors[0])]);
  }
  files.set("opening.png", [PNG_TYPE, makeBadgePng("#7c3aed", "#1e1b4b", { width: 320, height: 180 })]);
  files.set("ending.png", [PNG_TYPE, makeBadgePng("#0ea5e9", "#0c4a6e", { width: 320, height: 180 })]);
  files.set("opening.wav", [WAV_TYPE, makeWav(TUNES.opening)]);
  files.set("draw.wav", [WAV_TYPE, makeWav(TUNES.draw)]);
  files.set("ending.wav", [WAV_TYPE, makeWav(TUNES.ending)]);
  files.set("fanfare.wav", [WAV_TYPE, makeWav(TUNES.fanfare)]);
  return files;
}

/** 景品(レコードの `prizes`)。素材は名前で参照する。 */
export function buildPrizes() {
  return PRIZE_DEFS.map((p, i) => ({
    id: p.id,
    name: p.name,
    weight: p.weight,
    animation: p.animation,
    order: i + 1,
    image: prizeImageName(p, 1),
    image2: prizeImageName(p, 2),
    bgm1: "draw.wav",
    bgm2: "ending.wav",
    winningImage1: prizeImageName(p, 1),
    winningImage2: prizeImageName(p, 2),
  }));
}

const screen = (screenName, settingName, payload) => ({ screenName, settingName, settingValue: JSON.stringify(payload) });

/** 画面設定(レコードの `screens`)。オープニング・説明・抽選・デモ・結果・エンディング。素材は名前で参照する。 */
export function buildScreenSettings() {
  return [
    screen("opening", "opening-screen-settings", {
      bgm: "opening.wav",
      contents: [
        { type: "text", text: "オクトパス商事 年末ジャックポット抽選会", effect: "fade", duration: 4000 },
        { type: "text", text: "本日の景品は全6種類!豪華賞品をお楽しみに!", effect: "scroll", duration: 5000, se: "fanfare.wav" },
        { type: "image", media: "opening.png", effect: "static", duration: 3000 },
      ],
    }),
    screen("description", "description-screen-settings", {
      bgm: "opening.wav",
      contents: [
        { type: "text", content: "ルール説明", effect: "fade", duration: 1200 },
        { type: "text", content: "1人ずつルーレットで景品を決めます。当選者はスクリーンに大きく表示されます。", effect: "scroll", duration: 1500 },
        { type: "text", content: "運が良ければ「確変」で連続当選のチャンス!", effect: "fade", duration: 1500 },
      ],
    }),
    screen("main", "main-screen-settings", {
      memberLotteryBgms: ["draw.wav"],
      kakuhenMode: "auto",
      kakuhenFixedTimings: [],
    }),
    screen("demo", "demo-screen-settings", { demoBgm: "draw.wav", demoSe1: "fanfare.wav", demoSe2: "" }),
    screen("result", "result-screen-settings", { resultBgm: "ending.wav", resultSe1: "fanfare.wav", resultSe2: "" }),
    screen("ending", "ending-screen-settings", {
      bgm: "ending.wav",
      contents: [
        { type: "text", text: "ご参加ありがとうございました!", effect: "fade", duration: 5000 },
        { type: "image", media: "ending.png", effect: "static", duration: 3000 },
        { type: "text", text: "また来年お会いしましょう", effect: "static", duration: 4000 },
      ],
    }),
  ];
}

// ---------- クイズ ----------

const COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981"];
const OPTION_IMAGE_COLORS = [
  ["#ef4444", "#7f1d1d"],
  ["#f59e0b", "#78350f"],
  ["#ec4899", "#831843"],
  ["#10b981", "#064e3b"],
];

const QUIZ_DEFS = [
  { id: "seed-quiz-1", title: "オクトパス豆知識", question: "タコの心臓はいくつある?", choices: ["1つ", "2つ", "3つ", "4つ"], correctNo: 3, timeLimit: 20, bgm: true, prize: "オクトパス商事 特製ギフト" },
  { id: "seed-quiz-2", title: "暦のクイズ", question: "うるう年ではない年は、1年何日?", choices: ["364日", "365日", "366日"], correctNo: 2, timeLimit: 15 },
  { id: "seed-quiz-3", title: "果物クイズ", question: "次のうち、果物として売られているのはどれ?", choices: ["トマト", "きゅうり", "いちご", "ピーマン"], correctNo: 3, timeLimit: 25, images: true, prize: "旬のフルーツ詰め合わせ" },
  { id: "seed-quiz-4", title: "宇宙のクイズ", question: "太陽系で一番大きい惑星は?", choices: ["地球", "木星", "土星"], correctNo: 2, timeLimit: 20 },
  { id: "seed-quiz-5", title: "富士山クイズ", question: "富士山の標高はおよそ何メートル?", choices: ["2,776m", "3,776m", "4,776m"], correctNo: 2, timeLimit: 20 },
];

/** 中身のハッシュ(SHA-256 の先頭32桁・16進)。アプリの `hashBlob` と同じ。 */
export const blobHash = (body) => createHash("sha256").update(body).digest("hex").slice(0, 32);

/** クイズが参照する画像・音声。素材の名前(ファイル名)→ `[MIME, 中身]`。同じ名前は同じ素材として1つ(索引もファイルも1つ)。 */
const optionImageName = (i) => `option-${i + 1}.png`;
const optionImage = (i) => [PNG_TYPE, makeBadgePng(...OPTION_IMAGE_COLORS[i % OPTION_IMAGE_COLORS.length], { width: 160, height: 160 })];
const quizBgm = () => [WAV_TYPE, makeWav(TUNES.quiz)];
const prizeImage = () => [PNG_TYPE, makeBadgePng("#fbbf24", "#92400e", { width: 160, height: 160 })];
const prizeBgm = () => [WAV_TYPE, makeWav(TUNES.prize)];

/** 名前 → `[MIME, 中身]` の全素材。 */
function quizMediaFiles() {
  const files = new Map();
  for (const q of QUIZ_DEFS) {
    if (q.images) q.choices.forEach((_, i) => files.set(optionImageName(i), optionImage(i)));
    if (q.bgm) files.set("quiz-bgm.wav", quizBgm());
    if (q.prize) {
      files.set("prize.png", prizeImage());
      files.set("prize-bgm.wav", prizeBgm());
    }
  }
  return files;
}

/** クイズ一覧のクイズ(quiz-list.json の `quizzes`。アプリの QuizRepository と同じ形)。素材は名前で参照する。 */
export function buildQuizzes() {
  return QUIZ_DEFS.map((q) => ({
    id: q.id,
    title: q.title,
    question: q.question,
    options: q.choices.map((text, i) => ({ no: i + 1, text, color: COLORS[i], image: q.images ? optionImageName(i) : null })),
    correctNo: q.correctNo,
    timeLimit: q.timeLimit,
    bgm: q.bgm ? "quiz-bgm.wav" : null,
    settings: q.prize ? { correctBgm: null, prizeImage: "prize.png", prizeName: q.prize, prizeBgm: "prize-bgm.wav" } : undefined,
  }));
}

/** クイズ一覧のレコード `{ quizzes, media }`。media は、クイズが参照している素材の 名前 → { hash, mime, size }。 */
export function buildQuizRecord() {
  const files = quizMediaFiles();
  const media = {};
  for (const q of buildQuizzes()) {
    const names = [q.bgm, ...q.options.map((o) => o.image), q.settings?.correctBgm, q.settings?.prizeImage, q.settings?.prizeBgm];
    for (const name of names) {
      if (!name || name in media) continue;
      const [mime, body] = files.get(name);
      media[name] = { hash: blobHash(body), mime, size: body.length };
    }
  }
  return { quizzes: buildQuizzes(), media };
}

/** クイズ側のアセット。`[ハッシュ, MIME, 中身]`(同じ中身は1つにまとめる)。 */
export function buildQuizAssets() {
  const byHash = new Map();
  for (const [mime, body] of quizMediaFiles().values()) byHash.set(blobHash(body), [mime, body]);
  return [...byHash].map(([hash, [mime, body]]) => [hash, mime, body]);
}

/** ジャックポットの素材の名前(景品と画面設定が参照している名前)。 */
const SCREEN_MEDIA_KEYS = new Set(["bgm", "media", "se", "demoBgm", "demoSe1", "demoSe2", "resultBgm", "resultSe1", "resultSe2"]);
function screenMediaNames(settingValue) {
  const names = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    for (const [k, c] of Object.entries(v)) {
      if (SCREEN_MEDIA_KEYS.has(k) && typeof c === "string") names.push(c);
      else if (k === "memberLotteryBgms" && Array.isArray(c)) names.push(...c);
      else walk(c);
    }
  };
  walk(JSON.parse(settingValue));
  return names;
}

/** ジャックポットのレコード `{ prizes, screens, media }`。media は、景品と画面設定が参照している素材の 名前 → { hash, mime, size }。 */
export function buildJackpotRecord() {
  const files = jackpotMediaFiles();
  const prizes = buildPrizes();
  const screens = buildScreenSettings();
  const media = {};
  const names = [
    ...prizes.flatMap((p) => [p.image, p.image2, p.winningImage1, p.winningImage2, p.bgm1, p.bgm2]),
    ...screens.flatMap((s) => screenMediaNames(s.settingValue)),
  ];
  for (const name of names) {
    if (!name || name in media) continue;
    const [mime, body] = files.get(name);
    media[name] = { hash: blobHash(body), mime, size: body.length };
  }
  return { prizes, screens, media };
}

/** ジャックポット側のアセット。`[ハッシュ, MIME, 中身]`(同じ中身は1つにまとめる)。 */
export function buildJackpotAssets() {
  const byHash = new Map();
  for (const [mime, body] of jackpotMediaFiles().values()) byHash.set(blobHash(body), [mime, body]);
  return [...byHash].map(([hash, [mime, body]]) => [hash, mime, body]);
}

// ---------- R2 への書き込み一覧 ----------

/** アプリの同期が保存する一覧の形 `{ updatedAt, data }`(JSON のテキスト)にする。 */
const record = (data, updatedAt) => JSON.stringify({ updatedAt, data });

/** R2 に書く [キー, 値, Content-Type] の一覧(クイズ・景品・画面設定・アセット)。`updatedAt` は一覧の更新日時(ミリ秒。既定は今)。 */
export function buildContentEntries(updatedAt = Date.now()) {
  const entries = [
    ["quiz-game/json/quiz-list.json", record(buildQuizRecord(), updatedAt), JSON_TYPE],
    ["jackpot-game/json/jackpot-config.json", record(buildJackpotRecord(), updatedAt), JSON_TYPE],
  ];
  for (const [hash, mime, body] of buildJackpotAssets()) entries.push([`jackpot-game/assets/${hash}_blob`, body, mime]);
  for (const [hash, mime, body] of buildQuizAssets()) entries.push([`quiz-game/assets/${hash}_blob`, body, mime]);
  return entries;
}
