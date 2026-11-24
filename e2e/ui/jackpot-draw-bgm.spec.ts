import { strToU8, zipSync } from "fflate";
import type { Browser, APIRequestContext, Page } from "@playwright/test";
import { makeWav, TUNES } from "../../scripts/seed-content.js";
import { adminRpc, createSession, expect, joinPortalAs, newDevice, nextButton, openAdvanced, seedJackpot, test } from "./fixtures";
import { allStarts, installSoundTrace, soundFade, soundTrace, type SoundEvent } from "./helpers/sound-trace";

/**
 * 抽選BGM(メンバー抽選BGM・メンバー結果BGM・景品抽選BGM・当選BGM)と、停止秒数(メンバー・景品で別々)。
 * - どれも1回だけ流す(ループしない)。未設定なら何も鳴らさない。
 * - メンバー抽選BGMは停止が始まったらフェードアウト(音量が下がって止まり、音量は元に戻る)、メンバー結果BGMは結果ダイアログを閉じたら即停止、景品抽選BGMは、当選BGMがあれば停止が始まったら即停止(当選BGMが空なら、止まるまで流して止まったらフェードアウト)。
 * - 当選BGMは、リールが止まる瞬間に無音になるようフェードする。
 * - メンバー抽選と景品抽選で、停止から止まるまでの長さを別々に設定できる。
 * 音は再生の履歴(helpers/sound-trace.ts: <audio>・Web Audio のどちらで鳴らしても同じ形)とコンソールのログで確かめる。音源はテストの中で生成する(公開リポジトリのため)。
 */

/** 抽選の演出より長い曲(止める・フェードアウトするときに、まだ鳴っているように。短い曲は、止める前に自然に終わる)。 */
const longWav = (notes: Parameters<typeof makeWav>[0]) => makeWav(Array.from({ length: 8 }, () => notes).flat() as Parameters<typeof makeWav>[0]);

const MEMBER = { id: "jp-bgm-e2e-01", name: "音楽太郎" };
const sessionIds: string[] = [];
let memberKey = "";
const stamp = Date.now();
const MEMBER_BGM = `lot-member-${stamp}.wav`;
const RESULT_BGM = `lot-result-${stamp}.wav`;
const PRIZE_BGM = `lot-prize-${stamp}.wav`;

test.beforeAll(async ({ request }) => {
  await adminRpc(request, "accounts_addMember", MEMBER);
  memberKey = (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id: MEMBER.id })).key;
});
test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  await adminRpc(request, "accounts_deleteMember", { id: MEMBER.id });
});

/** 画面設定(screens.zip)の本抽選の行。列は screens.csv の並び。 */
const SCREENS_HEADER = "画面,BGM,メンバー抽選BGM,メンバー結果BGM,景品抽選BGM,デモ抽選,デモ回数,メンバー停止秒,景品停止秒,参加者の停止,確変の決め方,確変の回";
const zipOf = (mainRow: string) => ({
  name: "screens.zip",
  mimeType: "application/zip",
  buffer: Buffer.from(
    zipSync({
      "screens.csv": strToU8(`${SCREENS_HEADER}\r\n${mainRow}\r\n`),
      [`media/${MEMBER_BGM}`]: longWav(TUNES.draw),
      [`media/${RESULT_BGM}`]: longWav(TUNES.fanfare),
      [`media/${PRIZE_BGM}`]: longWav(TUNES.prize),
    })
  ),
});

/** ホスト画面の音の動きを記録する。`stallPlay`: 音が鳴り出さない状況(自動再生が止められる・読み込みが終わらない)を作る。 */
async function installAudioLog(page: Page, stallPlay = false) {
  await installSoundTrace(page.context());
  if (!stallPlay) return;
  await page.context().addInitScript(() => {
    // <audio> の play() が解決も拒否もしない / Web Audio の読み込み(デコード)が終わらない
    HTMLMediaElement.prototype.play = () => new Promise<void>(() => {});
    const ctx = (window as unknown as { BaseAudioContext?: { prototype: { decodeAudioData: unknown } } }).BaseAudioContext;
    if (ctx) ctx.prototype.decodeAudioData = () => new Promise(() => {});
  });
}
const audioLog = (page: Page) => soundTrace(page);
/** 止まった(<audio> の pause / Web Audio の stop・曲が終わった ended)出来事。短い曲は、止める前に自然に終わる。 */
const stops = (log: SoundEvent[]) => log.filter((x) => (x.kind === "media" && x.e === "pause") || (x.kind === "source" && (x.e === "stop" || x.e === "ended")));
/** 鳴らし始めた順の、音ごとの連番。 */
const soundIds = (log: SoundEvent[]) => [...new Set(allStarts(log).map((x) => x.id))];

async function scene(browser: Browser, request: APIRequestContext, label: string, setup: (host: Page) => Promise<void>, options: { stallPlay?: boolean } = {}) {
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await installAudioLog(host.page, options.stallPlay);
  const logs: string[] = [];
  host.page.on("console", (m) => {
    if (m.text().startsWith("[LotteryBgm]")) logs.push(m.text());
  });
  const pageErrors: string[] = [];
  host.page.on("pageerror", (e) => pageErrors.push(e.message));
  // 演出の途中の失敗(進行の「step failed」など)は、画面に出ずコンソールにだけ出る。落ちたときに原因が分かるよう残す
  const consoleErrors: string[] = [];
  host.page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  // 先にホスト画面を開いて、セッションが読み込まれる(タイトルが出る)のを待つ。ほかの景品抽選の spec と同じ順序。
  // 一覧の画面から画面設定を入れてすぐ開き直すと、実行環境(GAS は通信が遅い)によっては、セッションが見つかる前に15秒が過ぎる。
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  await setup(host.page);
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible({ timeout: 60_000 });
  const guest = await joinPortalAs(browser, request, sessionId, MEMBER.id, memberKey);
  await openAdvanced(admin.page);
  await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
  return { admin, host, guest, logs, pageErrors, consoleErrors };
}

const prizesOf = (kind: "roulette" | "slot") => ["特賞", "一等", "二等"].map((name, i) => ({ id: `jp-bgm-${kind}-${i + 1}`, name, order: i + 1, rank: 3, animation: kind }));

/** 管理コンソールの主ボタンが「止める」(指定の種類)になるまで「次へ」で進める。 */
async function advanceUntilStop(admin: Page, what: "メンバー" | "景品") {
  const next = nextButton(admin);
  const view = async () =>
    [await next.innerText().catch(() => ""), await admin.getByTestId("next-hint").innerText().catch(() => ""), await admin.getByTestId("jackpot-state").innerText().catch(() => "")].join("|");
  for (let i = 0; i < 40; i++) {
    await expect(next).not.toContainText("演出中", { timeout: 60_000 });
    const label = (await next.innerText().catch(() => "")).trim();
    const hint = (await admin.getByTestId("next-hint").innerText().catch(() => "")).trim();
    if (label.includes("止める") && hint.includes(what)) return;
    const before = await view();
    await next.click();
    await expect.poll(view, { timeout: 20_000 }).not.toBe(before);
  }
  throw new Error(`${what}を止められる状態にならなかった`);
}

/** 止めるボタンを押してから、管理端末の主ボタンの「演出中…」が消えるまでの時間(ミリ秒)。 */
async function stopAndMeasure(admin: Page): Promise<number> {
  const next = nextButton(admin);
  const clicked = Date.now();
  await next.click();
  await expect(next).toContainText("演出中", { timeout: 10_000 });
  await expect(next).not.toContainText("演出中", { timeout: 60_000 });
  return Date.now() - clicked;
}

const fadeOf = soundFade;

for (const kind of ["roulette", "slot"] as const) {
  test(`@motion 抽選BGM(${kind}): 設定した曲を1回だけ流し(ループしない)、メンバー抽選BGMはフェードアウト・結果BGMは閉じたら即停止・景品抽選BGMは(当選BGMが空なので)止まってからフェードアウト`, async ({ browser, request }) => {
    test.setTimeout(300_000);
    const { admin, host, guest, logs, pageErrors, consoleErrors } = await scene(browser, request, `抽選BGM-${kind}`, async (page) => {
      await seedJackpot(page, { prizes: prizesOf(kind) });
      await page.goto("/#/execute/jackpot-admin/screens/opening");
      await page.reload();
      await expect(page.getByTestId("table-export")).toBeVisible();
      await page.getByTestId("table-import-open").click();
      await page.getByTestId("table-import-table").setInputFiles(zipOf(`本抽選,,${MEMBER_BGM},${RESULT_BGM},${PRIZE_BGM},,,,,,なし,`));
      await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
      await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
    });

    // メンバー抽選: 開始で流れ、停止でフェードアウト
    await advanceUntilStop(admin.page, "メンバー");
    await expect.poll(() => logs.join("\n")).toContain(`memberLotteryBgms play ${MEMBER_BGM}`);
    await nextButton(admin.page).click();
    await expect.poll(() => logs.join("\n")).toContain("memberLotteryBgms fadeOut");

    // 景品抽選: 開始で流れる。この景品は当選BGMが空なので、停止開始では止めず、止まってからフェードアウトする(結果ダイアログを閉じるところまでに、メンバー結果BGMも流れて止まる)
    await advanceUntilStop(admin.page, "景品");
    await expect.poll(() => logs.join("\n")).toContain(`prizeLotteryBgms play ${PRIZE_BGM}`);
    // 回っているのを見てから止める(状態を待つ。回り始める前の「止める」は効かない)
    const reel = host.page.locator(`.${kind}-container`);
    await expect(reel.and(host.page.locator(".spinning")), "景品抽選が回っている").toBeVisible();
    await nextButton(admin.page).click();
    // 止まる演出が終わる(回転が止まる)のを待ち、そのあと結果が出る。失敗したら、画面で起きたエラーを添える
    await expect(reel.and(host.page.locator(".spinning")), `止まる演出が終わらない。画面のエラー: ${JSON.stringify([...pageErrors, ...consoleErrors])}`).toBeHidden({ timeout: 30_000 });
    await expect(host.page.getByText("景品当選"), `結果が出ない。画面のエラー: ${JSON.stringify([...pageErrors, ...consoleErrors])}`).toBeVisible({ timeout: 60_000 });

    // 順序: メンバー抽選(再生 → フェード)→ メンバー結果(再生)→ 景品抽選(再生)。ループ指定の曲は1つも無い。景品抽選BGMは、当選BGMが空なので止まってからフェードアウト
    expect(logs.map((l) => l.replace("[LotteryBgm] ", "").replace(/ \S+\.wav$/, ""))).toEqual(["memberLotteryBgms play", "memberLotteryBgms fadeOut", "memberResultBgms play", "prizeLotteryBgms play", "prizeLotteryBgms fadeOut"]);
    expect(logs.join("\n")).toContain(`memberResultBgms play ${RESULT_BGM}`);

    await expect.poll(async () => stops(await audioLog(host.page)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
    const prizeId = soundIds(await audioLog(host.page))[2];
    await expect.poll(async () => { const f = fadeOf(await audioLog(host.page), prizeId); return f.startAt !== undefined && f.stopAt !== undefined; }, { timeout: 15_000 }).toBe(true);
    const log = await audioLog(host.page);
    const plays = allStarts(log);
    expect(plays.filter((x) => x.loop), "どの曲もループしない").toEqual([]);
    const [member, result, prize] = [...new Set(plays.map((x) => x.id))];
    expect(new Set(plays.map((x) => x.id)).size, "<audio> は メンバー抽選・メンバー結果・景品抽選 の3つ(当選BGMは未設定)").toBe(3);
    // メンバー抽選BGM: フェード(約1.5秒) → 止まる → 音量が元に戻る
    const f = fadeOf(log, member);
    expect(f.startAt, "メンバー抽選BGM: 音量が下がり始めない").toBeDefined();
    expect(f.zeroAt, "メンバー抽選BGM: 音量が 0 まで下がらない").toBeDefined();
    expect(f.zeroAt! - f.startAt!, "フェードの長さ(約1.5秒)").toBeGreaterThan(1000);
    expect(f.zeroAt! - f.startAt!).toBeLessThan(3000);
    expect(f.stopAt, "フェードが終わってから止まる").toBeGreaterThanOrEqual(f.zeroAt! - 30);
    expect(f.restored, "止まったあとは音量が元に戻る").toBe(1);
    // メンバー結果BGM: フェードせず、すぐ止まる
    const resultLog = log.filter((x) => x.id === result);
    expect(stops(resultLog).length, "メンバー結果BGM: 止まる").toBeGreaterThan(0);
    expect(fadeOf(log, result).startAt, "メンバー結果BGM: 音量を下げない(即停止)").toBeUndefined();
    // 景品抽選BGM: 当選BGMが空なので、止まってからフェードアウトして止まる
    const pf = fadeOf(log, prize);
    expect(pf.startAt, "景品抽選BGM: 音量が下がり始める").toBeDefined();
    expect(pf.stopAt, "景品抽選BGM: フェードを始めてから止まる").toBeGreaterThanOrEqual(pf.startAt!);
    expect(pageErrors, "ホスト画面で例外が出た").toEqual([]);
    for (const d of [admin, host, guest]) await d.context.close();
  });
}

test("@motion 結果BGMが空なら、メンバー抽選BGM・景品抽選BGMは、止まるまで流れ続けて、止まってからフェードアウトする", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const STOP_SEC = 5;
  const { admin, host, guest, pageErrors } = await scene(browser, request, "抽選BGM-結果空", async (page) => {
    await seedJackpot(page, { prizes: prizesOf("roulette") });
    await page.goto("/#/execute/jackpot-admin/screens/opening");
    await page.reload();
    await expect(page.getByTestId("table-export")).toBeVisible();
    await page.getByTestId("table-import-open").click();
    await page.getByTestId("table-import-table").setInputFiles(zipOf(`本抽選,,${MEMBER_BGM},,${PRIZE_BGM},,,${STOP_SEC},${STOP_SEC},,なし,`));
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
  });
  /** 停止ボタンを押した時刻(ホストの performance.now)を返し、止まる演出が終わるまで待つ。 */
  const stopAt = async () => {
    const at = await host.page.evaluate(() => performance.now());
    await stopAndMeasure(admin.page);
    return at;
  };
  await advanceUntilStop(admin.page, "メンバー");
  const memberStop = await stopAt();
  await advanceUntilStop(admin.page, "景品");
  await expect(host.page.locator(".roulette-container.spinning"), "景品抽選が回っている").toBeVisible();
  const prizeStop = await stopAt();
  const ids = soundIds(await audioLog(host.page));
  const [member, prize] = ids;
  // フェードは時間で進む(待たない)ので、2曲とも止まる(pause)まで待つ
  for (const id of [member, prize]) await expect.poll(async () => { const f = fadeOf(await audioLog(host.page), id); return f.startAt !== undefined && f.stopAt !== undefined; }, { timeout: 15_000 }).toBe(true);
  const log = await audioLog(host.page);
  for (const [name, id, stoppedFrom] of [["メンバー抽選BGM", member, memberStop], ["景品抽選BGM", prize, prizeStop]] as const) {
    const f = fadeOf(log, id);
    expect(f.startAt, `${name}: 止まるまで音量を下げない(停止ボタンの直後に消えない)`).toBeGreaterThan(stoppedFrom + (STOP_SEC - 2) * 1000);
    expect(f.zeroAt, `${name}: 止まってから音量が下がる`).toBeDefined();
    expect(f.stopAt, `${name}: フェードを始めてから止まる`).toBeGreaterThanOrEqual(f.startAt!);
  }
  expect(pageErrors).toEqual([]);
  for (const d of [admin, host, guest]) await d.context.close();
});

test("@motion 当選BGMは1回だけ流れ、リールが止まる瞬間に無音になる(停止秒に合わせたフェード)", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const WIN_BGM = `lot-win-${stamp}.wav`;
  const STOP_SEC = 4;
  const { admin, host, guest, pageErrors, consoleErrors } = await scene(browser, request, "当選BGM", async (page) => {
    const main = { memberLotteryBgms: [], memberResultBgms: [], prizeLotteryBgms: [], kakuhenMode: "none", kakuhenFixedTimings: [], memberStopSec: 2, prizeStopSec: STOP_SEC, participantStop: true };
    await seedJackpot(page, { prizes: [], screens: [{ screenName: "main", settingName: "main-screen-settings", settingValue: JSON.stringify(main) }] });
    await page.goto("/#/execute/jackpot-admin/prizes");
    await page.reload();
    await expect(page.getByTestId("table-export")).toBeVisible();
    await page.getByTestId("table-import-open").click();
    const rows = ["特賞", "一等", "二等"].map((name, i) => `jp-bgm-win-${i + 1},${name},3,ルーレット,,${WIN_BGM}`);
    await page.getByTestId("table-import-table").setInputFiles({
      name: "prizes.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zipSync({ "prizes.csv": strToU8(["ID,名前,景品ランク,アニメーション,抽選画像,当選BGM", ...rows].join("\r\n") + "\r\n"), [`media/${WIN_BGM}`]: longWav(TUNES.fanfare) })),
    });
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
  });
  await advanceUntilStop(admin.page, "メンバー");
  await stopAndMeasure(admin.page);
  await advanceUntilStop(admin.page, "景品");
  const reel = host.page.locator(".roulette-container");
  await expect(reel.and(host.page.locator(".spinning")), "景品抽選が回っている").toBeVisible();
  await nextButton(admin.page).click();
  const errors = () => JSON.stringify([...pageErrors, ...consoleErrors]);
  await expect.poll(async () => allStarts(await audioLog(host.page)).length > 0, { message: `当選BGMが流れない。画面のエラー: ${errors()}`, timeout: 15_000 }).toBe(true);
  await expect(reel.and(host.page.locator(".spinning")), `止まる演出が終わらない。画面のエラー: ${errors()}`).toBeHidden({ timeout: 30_000 });
  const reelStoppedAt = await host.page.evaluate(() => performance.now());

  const log = await audioLog(host.page);
  const play = allStarts(log).at(-1)!;
  expect(allStarts(log).filter((x) => x.loop), "当選BGMはループしない").toEqual([]);
  const f = fadeOf(log, play.id);
  expect(f.zeroAt, "当選BGMの音量が 0 まで下がる").toBeDefined();
  expect(f.zeroAt!, "リールが止まったと分かる時点より後まで、音が残らない").toBeLessThan(reelStoppedAt + 500);
  expect(f.zeroAt! - play.t, `再生から停止秒(${STOP_SEC}秒)ほどで無音になる`).toBeGreaterThan((STOP_SEC - 1.5) * 1000);
  expect(f.zeroAt! - play.t).toBeLessThan((STOP_SEC + 1.5) * 1000);
  expect(f.stopAt, "無音になってから止まる").toBeGreaterThanOrEqual(f.zeroAt! - 30);
  expect(pageErrors).toEqual([]);
  for (const d of [admin, host, guest]) await d.context.close();
});

test("@motion 抽選BGMが未設定なら、何も鳴らさず(エラーにもならず)、抽選は今までどおり当選まで進む", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const { admin, host, guest, logs, pageErrors } = await scene(browser, request, "抽選BGM-未設定", async (page) => {
    await seedJackpot(page, {
      prizes: prizesOf("roulette"),
      screens: [{ screenName: "main", settingName: "main-screen-settings", settingValue: JSON.stringify({ memberLotteryBgms: [], memberResultBgms: [], prizeLotteryBgms: [], kakuhenMode: "none", kakuhenFixedTimings: [], memberStopSec: 2, prizeStopSec: 2, participantStop: true }) }],
    });
  });
  await advanceUntilStop(admin.page, "メンバー");
  await stopAndMeasure(admin.page);
  await advanceUntilStop(admin.page, "景品");
  await stopAndMeasure(admin.page);
  await expect(host.page.getByText("景品当選")).toBeVisible({ timeout: 60_000 });
  expect(logs, "設定が無いので、抽選BGMは鳴らさない").toEqual([]);
  expect(allStarts(await audioLog(host.page))).toEqual([]);
  expect(pageErrors).toEqual([]);
  for (const d of [admin, host, guest]) await d.context.close();
});

test("@motion 音の play() が終わらない(自動再生が止められるなど)状況でも、抽選は当選まで進む。フェードアウトの指示も出る", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const { admin, host, guest, logs, pageErrors, consoleErrors } = await scene(
    browser,
    request,
    "抽選BGM-play停滞",
    async (page) => {
      await seedJackpot(page, { prizes: prizesOf("roulette") });
      await page.goto("/#/execute/jackpot-admin/screens/opening");
      await page.reload();
      await expect(page.getByTestId("table-export")).toBeVisible();
      await page.getByTestId("table-import-open").click();
      await page.getByTestId("table-import-table").setInputFiles(zipOf(`本抽選,,${MEMBER_BGM},${RESULT_BGM},${PRIZE_BGM},,,,,,なし,`));
      await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
      await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
    },
    { stallPlay: true }
  );
  await advanceUntilStop(admin.page, "メンバー");
  await stopAndMeasure(admin.page);
  await advanceUntilStop(admin.page, "景品");
  await stopAndMeasure(admin.page);
  await expect(host.page.getByText("景品当選"), `結果が出ない。画面のエラー: ${JSON.stringify([...pageErrors, ...consoleErrors])}`).toBeVisible({ timeout: 60_000 });
  expect(logs.some((l) => l.includes("prizeLotteryBgms play"))).toBe(true);
  expect(pageErrors).toEqual([]);
  for (const d of [admin, host, guest]) await d.context.close();
});

test("@motion メンバー抽選と景品抽選で、停止から止まるまでの長さを別々に設定できる", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const settingValue = (memberStopSec: number, prizeStopSec: number) =>
    JSON.stringify({ memberLotteryBgms: [], memberResultBgms: [], prizeLotteryBgms: [], kakuhenMode: "none", kakuhenFixedTimings: [], memberStopSec, prizeStopSec, participantStop: true });
  const run = async (memberStopSec: number, prizeStopSec: number) => {
    const { admin, host, guest, pageErrors } = await scene(browser, request, `停止秒-${memberStopSec}-${prizeStopSec}`, async (page) => {
      await seedJackpot(page, { prizes: prizesOf("roulette"), screens: [{ screenName: "main", settingName: "main-screen-settings", settingValue: settingValue(memberStopSec, prizeStopSec) }] });
    });
    await advanceUntilStop(admin.page, "メンバー");
    const member = await stopAndMeasure(admin.page);
    await advanceUntilStop(admin.page, "景品");
    const prize = await stopAndMeasure(admin.page);
    expect(pageErrors).toEqual([]);
    for (const d of [admin, host, guest]) await d.context.close();
    return { member, prize };
  };
  // 景品を長く・メンバーを短く、と、その逆。通信の遅れ(実行環境で違う)は両方に同じだけ乗るので、
  // 「景品 − メンバー」の差を2つの設定で比べる。設定の差から 16秒(= (10−2) − (2−10))が出るはず。
  const a = await run(2, 10);
  const b = await run(10, 2);
  const diffA = a.prize - a.member;
  const diffB = b.prize - b.member;
  expect(diffA - diffB, `メンバー2秒・景品10秒: ${a.member}/${a.prize}ms、メンバー10秒・景品2秒: ${b.member}/${b.prize}ms`).toBeGreaterThan(10_000);
  expect(diffA, "景品を長くした方は、景品のほうが長くかかる").toBeGreaterThan(0);
  expect(diffB, "メンバーを長くした方は、メンバーのほうが長くかかる").toBeLessThan(0);
});

test("@motion 確変: ダミー抽選と本抽選のそれぞれで、景品抽選BGMは当選BGMの前に即止まり、当選BGM(ダミーは当選BGM、本抽選は確変の当選BGM)は1回ずつ鳴って、フェードで消える", async ({ browser, request }) => {
  test.setTimeout(420_000);
  const WIN1 = `lot-kwin1-${stamp}.wav`;
  const WIN2 = `lot-kwin2-${stamp}.wav`;
  const { admin, host, guest, logs, pageErrors, consoleErrors } = await scene(browser, request, "確変BGM", async (page) => {
    await seedJackpot(page, { prizes: [] });
    // 確変の予定は、このセッションの結果ファイルに先に決めておく(端末の設定との同期の競合を避ける。jackpot-cycle-latency と同じ)
    await adminRpc(request, "sessionHub_ensureJackpotPlan", { sessionId: sessionIds.at(-1)!, plan: { kakuhenTimings: [1], reservedPrizeIds: ["jp-kk-3"] } });
    await page.goto("/#/execute/jackpot-admin/prizes");
    await page.reload();
    await expect(page.getByTestId("table-export")).toBeVisible();
    await page.getByTestId("table-import-open").click();
    const header = "ID,名前,景品ランク,アニメーション,確変対応,当選対象,抽選画像,当選画像,当選BGM,確変_抽選画像,確変_当選画像,確変_当選BGM,確変_ダミー当選景品ID";
    const rows = ["jp-kk-1,通常一,3,ルーレット,なし,する,,,,,,,", "jp-kk-2,通常二,3,ルーレット,なし,する,,,,,,,", `jp-kk-3,確変景品,5,ルーレット,あり,する,,,${WIN1},,,${WIN2},`];
    await page.getByTestId("table-import-table").setInputFiles({
      name: "prizes.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zipSync({ "prizes.csv": strToU8([header, ...rows].join("\r\n") + "\r\n"), [`media/${WIN1}`]: longWav(TUNES.fanfare), [`media/${WIN2}`]: longWav(TUNES.ending) })),
    });
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("table-import-close").click();
    await page.goto("/#/execute/jackpot-admin/screens/opening");
    await page.reload();
    await expect(page.getByTestId("table-export")).toBeVisible();
    await page.getByTestId("table-import-open").click();
    await page.getByTestId("table-import-table").setInputFiles(zipOf(`本抽選,,,,${PRIZE_BGM},,,2,3,,,`));
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
  });
  await advanceUntilStop(admin.page, "メンバー");
  await stopAndMeasure(admin.page);
  // 確変の景品抽選は、ダミー抽選 → メッセージ → 本抽選。ダミー抽選が回り出して景品抽選BGMが鳴ってから、ホストの Enter で進める
  await advanceUntilStop(admin.page, "景品");
  const errors = () => JSON.stringify([...pageErrors, ...consoleErrors]);
  await expect.poll(async () => allStarts(await audioLog(host.page)).length, { message: `景品抽選BGMが鳴らない。画面のエラー: ${errors()}`, timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  /** 消える(フェードして止まる)音 = 当選BGM。景品抽選BGMはフェードしない。 */
  const faded = async () => {
    const log = await audioLog(host.page);
    return soundIds(log).filter((id) => fadeOf(log, id).zeroAt !== undefined && fadeOf(log, id).stopAt !== undefined);
  };
  for (let i = 0; i < 200 && (await faded()).length < 2; i++) {
    await host.page.keyboard.press("Enter");
    await host.page.waitForTimeout(900);
  }
  await expect.poll(async () => (await faded()).length, { message: `当選BGMが2つ(ダミー・確変)鳴ってフェードで消えない。画面のエラー: ${errors()}`, timeout: 30_000 }).toBe(2);
  const log = await audioLog(host.page);
  const starts = allStarts(log);
  const ids = soundIds(log);
  const [win1Id, win2Id] = await faded();
  const lotteries = ids.filter((id) => id !== win1Id && id !== win2Id);
  expect(starts.filter((x) => x.loop), "どの曲もループしない").toEqual([]);
  // 景品抽選BGMはダミー抽選で鳴る。本抽選の景品抽選BGMは、始めてすぐに止める操作が来ると鳴らさずに取りやめる(以前からの動き)ので、0〜1回
  expect(lotteries.length, "景品抽選BGMは、ダミー抽選で1回(本抽選で鳴れば2回)").toBeGreaterThanOrEqual(1);
  expect(lotteries.length).toBeLessThanOrEqual(2);
  expect(logs.filter((l) => l.includes("prizeLotteryBgms play")).length, "景品抽選BGMの再生の記録と、鳴った数が合う").toBe(lotteries.length);
  const startOf = (id: number) => starts.find((x) => x.id === id)!.t;
  const win1 = { id: win1Id, ...fadeOf(log, win1Id), start: startOf(win1Id) };
  const win2 = { id: win2Id, ...fadeOf(log, win2Id), start: startOf(win2Id) };
  expect(win2.start, "ダミー抽選の当選BGMのあとに、確変の当選BGMが鳴る").toBeGreaterThan(win1.start);
  for (const id of lotteries) {
    const l = fadeOf(log, id);
    expect(l.startAt, "景品抽選BGM: 音量を下げず、即止まる").toBeUndefined();
    expect(l.stopAt, "景品抽選BGM: 止まる").toBeDefined();
    const next = startOf(id) < win1.start ? win1 : win2;
    expect(l.stopAt!, "景品抽選BGMは、次の当選BGMが鳴る前までに止まる").toBeLessThanOrEqual(next.start + 50);
  }
  expect(win1.stopAt!, "ダミー抽選の当選BGMは、確変の当選BGMが鳴る前に消えている").toBeLessThanOrEqual(win2.start + 50);
  for (const w of [win1, win2]) expect(w.zeroAt! - w.startAt!, "当選BGMはフェードで消える").toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
  for (const d of [admin, host, guest]) await d.context.close();
});
