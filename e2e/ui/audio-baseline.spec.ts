import { strToU8, zipSync } from "fflate";
import type { Page } from "@playwright/test";
import { makeWav, TUNES } from "../../scripts/seed-content.js";
import { AUDIO_BASELINE, baselineRow } from "./helpers/audio-baseline";
import { seedServerAsset, silentWav, uid } from "./helpers/media";
import { activeSounds, allStarts, installSoundTrace, soundTrace, starts, type SoundEvent } from "./helpers/sound-trace";
import { adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, publishPortal, route, seedJackpot, test } from "./fixtures";

/**
 * 音の再生を1つにまとめる(work/audio-unify)前の、main の「正解の動き」。
 * 表は `helpers/audio-baseline.ts`(各行の ID は、このファイルのテスト名にも使う)。
 * 再生状態は `helpers/sound-trace.ts` で、`<audio>`・`new Audio`・Web Audio のどれで鳴らしても同じ形で取り出す。
 * 音源はテストの中で生成する(公開リポジトリのため)。
 *
 * ここで確かめない行(ジャックポットの抽選BGM・当選BGM・クイズのイントロ/ランキング/景品・場内BGMの再生/停止)は、
 * 表の `checkedBy` にある既存の e2e が確かめている。
 */

const stamp = Date.now();
const sessionIds: string[] = [];
/** このファイルが書き換えるサーバー上のデータ(ジャックポット・クイズの設定)。ほかの spec は「何も設定されていない」ことを前提にするので、終わったら元に戻す。 */
const RECORDS = [
  { get: "jackpotGame_getRecord", save: "jackpotGame_saveRecord", empty: { schemaVersion: 2, prizes: [], screens: [], media: {} } },
  { get: "quizGame_getRecord", save: "quizGame_saveRecord", empty: { quizzes: [], media: {} } },
] as const;
const originals = new Map<string, string | null>();

test.beforeAll(async ({ request }) => {
  for (const r of RECORDS) originals.set(r.get, (await adminRpc<{ json: string | null }>(request, r.get, {})).json);
});
test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const r of RECORDS) {
    const before = originals.get(r.get);
    const data = before ? (JSON.parse(before) as { data: unknown }).data : r.empty;
    await adminRpc(request, r.save, { json: JSON.stringify({ updatedAt: Date.now(), data }) });
  }
});

test("表の行は、ID が重複せず、すべて確かめ方が書かれている", () => {
  const ids = AUDIO_BASELINE.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const row of AUDIO_BASELINE) expect(row.checkedBy.length, row.id).toBeGreaterThan(0);
});

test("e2e のブラウザでは、音の中心(SoundSystem)の状態を window.__sound.snapshot() で読める(何も鳴らしていなければ、全チャンネルが空)", async ({ browser }) => {
  const dev = await newDevice(browser, { signedIn: true });
  await dev.page.goto("/#/sessions");
  const snapshot = await dev.page.evaluate(() => (window as unknown as { __sound?: { snapshot: () => unknown } }).__sound?.snapshot());
  expect(snapshot).toMatchObject({ audio: expect.stringMatching(/^(suspended|running)$/), venue: { current: null, tracks: [] }, screen: { current: null, tracks: [] }, effect: { current: null, tracks: [] } });
  await dev.context.close();
});

// ---------------------------------------------------------------- ジャックポットの画面BGM

const A = `ab-a-${stamp}.wav`;
const B = `ab-b-${stamp}.wav`;
const durationOf = (notes: Parameters<typeof makeWav>[0]) => {
  // WAV(8kHz・8bit・モノラル)の長さ。データ部のバイト数 / サンプルレート
  const wav = makeWav(notes);
  return Math.round(((wav.length - 44) / 8000) * 100) / 100;
};
const DUR = { A: durationOf(TUNES.opening), B: durationOf(TUNES.ending), C: durationOf(TUNES.fanfare) };

const SCREENS_HEADER = "画面,BGM,メンバー抽選BGM,メンバー結果BGM,景品抽選BGM,デモ抽選,デモ回数,メンバー停止秒,景品停止秒,参加者の停止,確変の決め方,確変の回";
const PAGES_HEADER = "画面,種類,文字,画像,効果,秒数,行数,効果音,名前";
const screenRow = (screen: string, bgm: string) => `${screen},${bgm}${",".repeat(10)}`;

/** 画面(オープニング・説明・最終結果・エンディング)の BGM を設定して取り込む。 */
async function importScreens(page: Page, bgms: { opening: string; description: string; result: string; ending: string; demo?: string }, files: Record<string, Buffer>) {
  const zip = zipSync({
    "screens.csv": strToU8(
      [SCREENS_HEADER, screenRow("オープニング", bgms.opening), screenRow("説明", bgms.description), screenRow("最終結果", bgms.result), screenRow("エンディング", bgms.ending), ...(bgms.demo ? [`デモ抽選,${bgms.demo},,,,あり,1,,,,,`] : [])].join("\r\n") + "\r\n"
    ),
    "pages.csv": strToU8([PAGES_HEADER, "オープニング,テキスト,ようこそ,,静止,0.6,,,", "説明,テキスト,説明です,,,,,,", "エンディング,テキスト,おわり,,静止,0.6,,,"].join("\r\n") + "\r\n"),
    ...Object.fromEntries(Object.entries(files).map(([name, body]) => [`media/${name}`, body])),
  });
  await page.goto("/#/execute/jackpot-admin/screens/opening");
  await page.reload();
  await expect(page.getByTestId("table-export")).toBeVisible();
  await page.getByTestId("table-import-open").click();
  await page.getByTestId("table-import-table").setInputFiles({ name: "screens.zip", mimeType: "application/zip", buffer: Buffer.from(zip) });
  await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
  await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
}

/** 画面を切り替える(ページを読み直さない。鳴っている音を引き継げるかを見るため)。 */
const goto = (page: Page, path: string) => page.evaluate((p) => void (location.hash = `#${p}`), path);

async function jackpotDevice(browser: Parameters<Parameters<typeof test>[2]>[0]["browser"]) {
  const dev = await newDevice(browser, { signedIn: true });
  await installSoundTrace(dev.context);
  dev.page.on("dialog", (d) => void d.dismiss());
  const pageErrors: string[] = [];
  dev.page.on("pageerror", (e) => pageErrors.push(e.message));
  return { dev, pageErrors };
}

/** この画面で、いま鳴っている音がちょうど1つで、その長さ・ループが期待どおりになるまで待つ。 */
async function expectSingle(page: Page, expected: { duration: number; loop: boolean }, message: string) {
  await expect
    .poll(async () => (await activeSounds(page)).map((s) => ({ duration: s.duration, loop: s.loop })), { message, timeout: 30_000 })
    .toEqual([{ duration: expected.duration, loop: expected.loop }]);
  return (await activeSounds(page))[0];
}

test.describe("ジャックポットの画面BGM", () => {
  test(`${baselineRow("J1").id} オープニング: BGMをループで流し、画面を離れたら止める。${baselineRow("J2").id} 説明: 違う曲なら、前の曲を止めて、新しい曲を最初から流す`, async ({ browser }) => {
    test.setTimeout(180_000);
    const { dev, pageErrors } = await jackpotDevice(browser);
    await dev.page.goto("/#/sessions");
    await seedJackpot(dev.page, { prizes: [{ id: "ab-p1", name: "景品", order: 1, rank: 3, animation: "roulette" }] });
    await importScreens(dev.page, { opening: A, description: B, result: A, ending: A }, { [A]: makeWav(TUNES.opening), [B]: makeWav(TUNES.ending) });

    await goto(dev.page, "/execute/jackpot-opening");
    const opening = await expectSingle(dev.page, { duration: DUR.A, loop: true }, "オープニングのBGMが、ループで流れる");

    await goto(dev.page, "/execute/jackpot-description");
    const description = await expectSingle(dev.page, { duration: DUR.B, loop: true }, "説明のBGM(オープニングとは別の曲)が流れ、オープニングのBGMは止まる");
    expect(description.id, "別の曲は別の再生").not.toBe(opening.id);
    const log = await soundTrace(dev.page);
    expect(allStarts(log).map((x) => x.loop), "2曲とも、ループで鳴らし始めた").toEqual([true, true]);

    // 説明を離れると止まる
    await goto(dev.page, "/execute/jackpot-history");
    await expect.poll(() => activeSounds(dev.page), { message: "画面を離れたら止まる" }).toEqual([]);
    expect(pageErrors).toEqual([]);
    await dev.context.close();
  });

  test(`${baselineRow("J2").id}s 説明(同じ曲): 同じ曲は、画面が変わっても途切れず流し続ける(PR2 で変えた行。変更前は鳴らし直していた)`, async ({ browser }) => {
    test.setTimeout(180_000);
    const { dev, pageErrors } = await jackpotDevice(browser);
    await dev.page.goto("/#/sessions");
    await seedJackpot(dev.page, { prizes: [{ id: "ab-p1", name: "景品", order: 1, rank: 3, animation: "roulette" }] });
    await importScreens(dev.page, { opening: A, description: A, result: A, ending: A }, { [A]: makeWav(TUNES.opening) });

    await goto(dev.page, "/execute/jackpot-opening");
    const opening = await expectSingle(dev.page, { duration: DUR.A, loop: true }, "オープニングのBGM");
    await goto(dev.page, "/execute/jackpot-description");
    // 説明の画面の準備ができるまで待ってから確かめる(準備のあとに鳴らし直されないこと)
    await expect(dev.page.getByTestId("description-text")).toBeVisible({ timeout: 30_000 });
    await dev.page.waitForTimeout(1500);
    expect((await activeSounds(dev.page)).map((x) => x.id), "同じ再生が続いている").toEqual([opening.id]);
    expect(allStarts(await soundTrace(dev.page)), "鳴らし直していない(1回だけ鳴らした)").toHaveLength(1);
    // 同じ曲でも、最後は止まる(ゲームの画面を出る)
    await goto(dev.page, "/execute/jackpot-history");
    await expect.poll(() => activeSounds(dev.page), { message: "BGMの無い画面へ移ると止まる" }).toEqual([]);
    expect(pageErrors).toEqual([]);
    await dev.context.close();
  });

  test(`${baselineRow("J3").id} デモ抽選: BGMをループで流し、抽選が始まったら止める`, async ({ browser, request }) => {
    test.setTimeout(180_000);
    const members = ["ab-m1", "ab-m2"];
    for (const id of members) await adminRpc(request, "accounts_addMember", { id, name: `基準${id.slice(-1)}` });
    try {
      const { dev, pageErrors } = await jackpotDevice(browser);
      await dev.page.goto("/#/sessions");
      await seedJackpot(dev.page, { prizes: [{ id: "ab-p1", name: "景品", order: 1, rank: 3, animation: "roulette" }] });
      await importScreens(dev.page, { opening: A, description: A, result: A, ending: A, demo: B }, { [A]: makeWav(TUNES.opening), [B]: makeWav(TUNES.ending) });

      await goto(dev.page, "/execute/jackpot-demo-draw");
      // 画面を開くとBGMを流し始め(ループ)、単体実行(ホストなし)では練習の抽選がすぐ始まるので、始まったら止まる
      await expect
        .poll(async () => allStarts(await soundTrace(dev.page)).map((x) => ({ duration: x.duration || DUR.B, loop: x.loop })), { message: "デモ抽選のBGMが、ループで流れ始める", timeout: 30_000 })
        .toEqual([{ duration: DUR.B, loop: true }]);
      await expect.poll(() => activeSounds(dev.page), { message: "抽選が始まったらBGMは止まる", timeout: 30_000 }).toEqual([]);
      expect(allStarts(await soundTrace(dev.page)), "鳴らし直さない").toHaveLength(1);
      expect(pageErrors).toEqual([]);
      await dev.context.close();
    } finally {
      for (const id of members) await adminRpc(request, "accounts_deleteMember", { id }).catch(() => undefined);
    }
  });

  test(`${baselineRow("J4").id} 最終結果は ${baselineRow("J4").delay} 遅らせて、${baselineRow("J5").id} エンディングは ${baselineRow("J5").delay} 遅らせて、BGMをループで流す`, async ({ browser }) => {
    test.setTimeout(180_000);
    const { dev, pageErrors } = await jackpotDevice(browser);
    await dev.page.goto("/#/sessions");
    await seedJackpot(dev.page, { prizes: [{ id: "ab-p1", name: "景品", order: 1, rank: 3, animation: "roulette" }] });
    await importScreens(dev.page, { opening: A, description: A, result: B, ending: A }, { [A]: makeWav(TUNES.opening), [B]: makeWav(TUNES.ending) });

    const measure = async (path: string, expected: { duration: number; loop: boolean }, message: string) => {
      const before = await dev.page.evaluate(() => performance.now());
      await goto(dev.page, path);
      await expectSingle(dev.page, expected, message);
      const first = allStarts(await soundTrace(dev.page)).at(-1)!;
      return first.t - before;
    };
    const resultMs = await measure("/execute/jackpot-result", { duration: DUR.B, loop: true }, "最終結果のBGMが流れる");
    expect(resultMs, "最終結果は 1200ms 遅らせて鳴らす").toBeGreaterThanOrEqual(1200);
    const endingMs = await measure("/execute/jackpot-ending", { duration: DUR.A, loop: true }, "エンディングのBGMが流れ、最終結果のBGMは止まる");
    expect(endingMs, "エンディングは 500ms 遅らせて鳴らす").toBeGreaterThanOrEqual(500);
    expect(pageErrors).toEqual([]);
    await dev.context.close();
  });
});

// ---------------------------------------------------------------- 場内BGMとゲーム

/** 履歴のうち、Web Audio のソースの start / stop(または自然終了)だけ。 */
const sourceEvents = (log: SoundEvent[]) => log.filter((x) => x.kind === "source").map((x) => x.e);

test(`${baselineRow("V1").id} 場内BGMを鳴らす → ${baselineRow("V3").id} ゲームに入ると1秒のフェードアウトで一時停止し、出ると1秒のフェードインで再開する`, async ({ browser, request }) => {
  test.setTimeout(240_000);
  const tag = uid();
  const song = { id: `abvenue${tag}`, fileName: `ab-venue-${tag}.wav`, mime: "audio/wav", body: silentWav() };
  await seedServerAsset(request, song);

  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "音の基準");
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await installSoundTrace(host.context);
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  await seedJackpot(host.page, {
    prizes: [{ id: "ab-vp1", name: "景品", order: 1, rank: 3, animation: "roulette" }],
    screens: [{ screenName: "opening", settingName: "opening-screen-settings", settingValue: JSON.stringify({ bgm: "", items: [{ kind: "テキスト", text: "ようこそ", effect: "静止", seconds: 0.6 }] }) }],
  });
  await publishPortal(request, sessionId);
  await admin.page.getByTestId("media-reload").click();

  // V1: 再生すると、Web Audio で、曲の長さ(20秒)をループなしで鳴らす
  await admin.page.getByTestId(`media-play-${song.id}`).click();
  await expect.poll(async () => (await activeSounds(host.page)).map((s) => ({ kind: s.kind, duration: s.duration, loop: s.loop })), { timeout: 30_000 }).toEqual([{ kind: "source", duration: 20, loop: false }]);
  const sourceId = (await activeSounds(host.page))[0].id;

  // V3: ゲームに入ると、場内BGMが止まる(1秒のフェードアウトのあと)。音量の予約に、0 までの下りがある
  const entered = await host.page.evaluate(() => performance.now());
  await admin.page.getByTestId("start-jackpot").click();
  // オープニングは短いので、環境によっては、確かめる前に説明へ進んでいる。ゲームの画面に入ったことだけ見る
  await expect.poll(() => route(host.page), { timeout: 60_000 }).toMatch(/^\/execute\/jackpot-/);
  await expect.poll(async () => (await activeSounds(host.page)).length, { message: "ゲーム中は場内BGMが鳴らない", timeout: 30_000 }).toBe(0);
  let log = await soundTrace(host.page);
  const stop = log.find((x) => x.kind === "source" && x.e === "stop" && x.id === sourceId)!;
  expect(stop, "場内BGMのソースが止まる").toBeTruthy();
  expect(stop.t - entered, "フェードアウトの1秒が終わってから止まる").toBeGreaterThanOrEqual(900);
  expect(log.some((x) => x.kind === "gain" && x.e === "ramp" && x.v === 0), "0 に向かって音量を下げる予約がある").toBe(true);

  // ゲームを出る(ロビーへ戻る)と、続きから再開する(新しいソースが鳴り、1秒かけて音量が戻る)
  const left = await host.page.evaluate(() => performance.now());
  await host.page.evaluate((id) => void (location.hash = `#/session/host/${id}`), sessionId);
  await expect.poll(async () => (await activeSounds(host.page)).map((s) => ({ kind: s.kind, duration: s.duration, loop: s.loop })), { message: "ゲームを出ると場内BGMが再開する", timeout: 30_000 }).toEqual([{ kind: "source", duration: 20, loop: false }]);
  log = await soundTrace(host.page);
  const resumed = log.filter((x) => x.kind === "source" && x.e === "start" && x.t > left);
  expect(resumed, "再開は新しいソースの start").toHaveLength(1);
  expect(log.some((x) => x.kind === "gain" && x.e === "ramp" && (x.v ?? 0) > 0 && x.t > left), "0 から元の音量へ上げる予約がある").toBe(true);
  expect(sourceEvents(log).filter((e) => e === "start")).toHaveLength(2);

  // 止める(管理画面の「停止」)
  await admin.page.getByTestId(`media-stop-${song.id}`).click();
  await expect.poll(async () => (await activeSounds(host.page)).length, { timeout: 30_000 }).toBe(0);
  for (const d of [admin, host]) await d.context.close();
});

// ---------------------------------------------------------------- クイズ(出題中・正解表示)

const QUIZ_ID = `ab-quiz-${stamp}`;
const PLAY_BGM = `ab-qplay-${stamp}.wav`;
const CORRECT_BGM = `ab-qcorrect-${stamp}.wav`;

test(`${baselineRow("Q2").id} 出題中のBGMをループで流し、回答画面へ進むと止める。${baselineRow("Q3").id} 正解表示の正解BGMは1回だけ流し(ループしない)、画面を離れたら止める`, async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "クイズ音の基準");
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await installSoundTrace(host.context);
  const pageErrors: string[] = [];
  host.page.on("pageerror", (e) => pageErrors.push(e.message));

  const header = "ID,タイトル,問題,制限時間(秒),正解(選択肢の番号),BGM,正解BGM,選択肢1,選択肢2";
  const row = `${QUIZ_ID},音のクイズ,みかんはどれ?,30,2,${PLAY_BGM},${CORRECT_BGM},りんご,みかん`;
  const quizzes = {
    name: "quizzes.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zipSync({ "quizzes.csv": strToU8(`${header}\r\n${row}\r\n`), [`media/${PLAY_BGM}`]: makeWav(TUNES.quiz), [`media/${CORRECT_BGM}`]: makeWav(TUNES.ending) })),
  };
  for (const page of [admin.page, host.page]) {
    await page.goto("/#/quiz-admin");
    await expect(page.getByTestId("table-export")).toBeVisible();
    await page.getByTestId("table-import-open").click();
    await page.getByTestId("table-import-table").setInputFiles(quizzes);
    await expect(page.getByTestId("table-import-counts")).toContainText("エラー 0");
    const apply = page.getByRole("dialog").getByRole("button", { name: "取り込む" });
    if (await apply.isEnabled()) {
      await apply.click();
      await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
      await page.getByTestId("table-import-close").click();
    } else {
      await page.getByRole("button", { name: "閉じる" }).click();
    }
  }
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  await admin.page.goto(`/#/session/console/${sessionId}`);
  await expect(admin.page.getByTestId("quiz-select")).toBeVisible({ timeout: 30_000 });
  await admin.page.getByTestId("quiz-select").selectOption(QUIZ_ID);
  await openAdvanced(admin.page);

  // Q2: 出題 → BGM がループで流れる
  await admin.page.getByTestId("advanced").getByRole("button", { name: "出題" }).click();
  await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe(`/execute/quiz/${QUIZ_ID}/play`);
  const play = await expectSingle(host.page, { duration: durationOf(TUNES.quiz), loop: true }, "出題中のBGMがループで流れる");

  // 受付を締め切る(onFinish)と止まる
  const next = nextButton(admin.page);
  await expect(admin.page.getByTestId("now")).toContainText("回答受付中", { timeout: 30_000 });
  await next.click();
  await expect(host.page.getByText("受付を終了しました")).toBeVisible({ timeout: 30_000 });
  await expect(next).not.toContainText("締め切る");
  await expect.poll(async () => (await activeSounds(host.page)).some((s) => s.id === play.id), { message: "締め切ると出題中のBGMは止まる" }).toBe(false);

  // Q3: 正解 → 正解BGM が1回だけ(ループしない)流れ、離れると止まる
  await next.click();
  await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe(`/execute/quiz/${QUIZ_ID}/answer`);
  // 遅い環境(GAS)では、鳴っている間に確かめ損ねないよう、再生の履歴で確かめる
  await expect
    .poll(async () => starts(await soundTrace(host.page), "media").filter((x) => !x.loop && x.id !== play.id).map((x) => x.id).length, { message: "正解BGMが、ループなしで流れる", timeout: 60_000 })
    .toBe(1);
  const correct = starts(await soundTrace(host.page), "media").filter((x) => !x.loop && x.id !== play.id)[0];
  await next.click(); // → ランキング
  await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe(`/execute/quiz/${QUIZ_ID}/result`);
  await expect.poll(async () => (await activeSounds(host.page)).some((s) => s.id === correct.id), { message: "正解を離れたら正解BGMは止まる" }).toBe(false);
  expect(pageErrors).toEqual([]);
  for (const d of [admin, host]) await d.context.close();
});
