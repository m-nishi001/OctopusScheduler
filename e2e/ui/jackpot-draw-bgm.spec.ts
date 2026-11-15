import { strToU8, zipSync } from "fflate";
import type { Browser, APIRequestContext, Page } from "@playwright/test";
import { makeWav, TUNES } from "../../scripts/seed-content.js";
import { adminRpc, createSession, expect, joinPortalAs, newDevice, nextButton, openAdvanced, seedJackpot, test } from "./fixtures";

/**
 * 抽選BGM(メンバー抽選BGM・メンバー結果BGM・景品抽選BGM・当選BGM)と、停止秒数(メンバー・景品で別々)。
 * - どれも1回だけ流す(ループしない)。未設定なら何も鳴らさない。
 * - メンバー抽選BGMは停止が始まったらフェードアウト(音量が下がって止まり、音量は元に戻る)、メンバー結果BGMは結果ダイアログを閉じたら即停止、景品抽選BGMは停止が始まったら即停止。
 * - 当選BGMは、リールが止まる瞬間に無音になるようフェードする。
 * - メンバー抽選と景品抽選で、停止から止まるまでの長さを別々に設定できる。
 * 音は再生のイベント(<audio> の play / pause / volume)とコンソールのログで確かめる。音源はテストの中で生成する(公開リポジトリのため)。
 */

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
      [`media/${MEMBER_BGM}`]: makeWav(TUNES.draw),
      [`media/${RESULT_BGM}`]: makeWav(TUNES.fanfare),
      [`media/${PRIZE_BGM}`]: makeWav(TUNES.prize),
    })
  ),
});

/** ホスト画面の <audio> の動きを記録する(play / pause / volume)。 */
async function installAudioLog(page: Page, stallPlay = false) {
  await page.context().addInitScript((stall: boolean) => {
    const log: Array<{ t: number; e: string; id: number; loop?: boolean; v?: number }> = [];
    (window as unknown as { __audioLog: typeof log }).__audioLog = log;
    const ids = new WeakMap<object, number>();
    let count = 0;
    const idOf = (el: object) => {
      if (!ids.has(el)) ids.set(el, ++count);
      return ids.get(el)!;
    };
    const proto = HTMLMediaElement.prototype;
    const play = proto.play;
    proto.play = function (this: HTMLMediaElement) {
      log.push({ t: performance.now(), e: "play", id: idOf(this), loop: this.loop });
      // 自動再生が止められたときのように、play() が解決も拒否もしない状況を作る
      return stall ? new Promise<void>(() => {}) : play.call(this);
    };
    const pause = proto.pause;
    proto.pause = function (this: HTMLMediaElement) {
      log.push({ t: performance.now(), e: "pause", id: idOf(this) });
      return pause.call(this);
    };
    const volume = Object.getOwnPropertyDescriptor(proto, "volume")!;
    Object.defineProperty(proto, "volume", {
      configurable: true,
      get: volume.get,
      set(this: HTMLMediaElement, v: number) {
        log.push({ t: performance.now(), e: "volume", id: idOf(this), v });
        volume.set!.call(this, v);
      },
    });
  }, stallPlay);
}
const audioLog = (page: Page) => page.evaluate(() => (window as unknown as { __audioLog: Array<{ t: number; e: string; id: number; loop?: boolean; v?: number }> }).__audioLog);

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

/** この <audio> の、フェードアウトの経過: 音量が下がり始めた時刻・0 になった時刻・止まった時刻・止まったあとの音量。 */
function fadeOf(log: Awaited<ReturnType<typeof audioLog>>, id: number) {
  const mine = log.filter((x) => x.id === id);
  const play = mine.find((x) => x.e === "play");
  const start = mine.findIndex((x) => x.e === "volume" && (x.v ?? 1) < 1 && x.t > (play?.t ?? 0));
  const volumes = mine.slice(start).filter((x) => x.e === "volume");
  const pause = mine.find((x, i) => i >= start && x.e === "pause");
  const zeroAt = volumes.find((x) => (x.v ?? 1) <= 0.001)?.t;
  const after = mine.filter((x) => x.e === "volume" && pause && x.t >= pause.t);
  return { play, startAt: mine[start]?.t, zeroAt, pauseAt: pause?.t, restored: after.at(-1)?.v, volumes: volumes.map((x) => x.v ?? 1).filter((v) => v < 1 || true) };
}

for (const kind of ["roulette", "slot"] as const) {
  test(`@motion 抽選BGM(${kind}): 設定した曲を1回だけ流し(ループしない)、メンバー抽選BGMはフェードアウト・結果BGMは閉じたら即停止・景品抽選BGMは停止開始で即停止`, async ({ browser, request }) => {
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

    // 景品抽選: 開始で流れ、停止開始で即止まる(結果ダイアログを閉じるところまでに、メンバー結果BGMも流れて止まる)
    await advanceUntilStop(admin.page, "景品");
    await expect.poll(() => logs.join("\n")).toContain(`prizeLotteryBgms play ${PRIZE_BGM}`);
    // 回っているのを見てから止める(状態を待つ。回り始める前の「止める」は効かない)
    const reel = host.page.locator(`.${kind}-container`);
    await expect(reel.and(host.page.locator(".spinning")), "景品抽選が回っている").toBeVisible();
    const stopClickedAt = await host.page.evaluate(() => performance.now());
    await nextButton(admin.page).click();
    // 止まる演出が終わる(回転が止まる)のを待ち、そのあと結果が出る。失敗したら、画面で起きたエラーを添える
    await expect(reel.and(host.page.locator(".spinning")), `止まる演出が終わらない。画面のエラー: ${JSON.stringify([...pageErrors, ...consoleErrors])}`).toBeHidden({ timeout: 30_000 });
    await expect(host.page.getByText("景品当選"), `結果が出ない。画面のエラー: ${JSON.stringify([...pageErrors, ...consoleErrors])}`).toBeVisible({ timeout: 60_000 });

    // 順序: メンバー抽選(再生 → フェード)→ メンバー結果(再生)→ 景品抽選(再生)。ループ指定の曲は1つも無い。景品抽選BGMは、フェードでなく即停止
    expect(logs.map((l) => l.replace("[LotteryBgm] ", "").replace(/ \S+\.wav$/, ""))).toEqual(["memberLotteryBgms play", "memberLotteryBgms fadeOut", "memberResultBgms play", "prizeLotteryBgms play"]);
    expect(logs.join("\n")).toContain(`memberResultBgms play ${RESULT_BGM}`);

    await expect.poll(async () => (await audioLog(host.page)).filter((x) => x.e === "pause").length, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
    const log = await audioLog(host.page);
    const plays = log.filter((x) => x.e === "play");
    expect(plays.filter((x) => x.loop), "どの曲もループしない").toEqual([]);
    const [member, result, prize] = [...new Set(plays.map((x) => x.id))];
    expect(new Set(plays.map((x) => x.id)).size, "<audio> は メンバー抽選・メンバー結果・景品抽選 の3つ(当選BGMは未設定)").toBe(3);
    // メンバー抽選BGM: フェード(約1.5秒) → 止まる → 音量が元に戻る
    const f = fadeOf(log, member);
    expect(f.startAt, "メンバー抽選BGM: 音量が下がり始めない").toBeDefined();
    expect(f.zeroAt, "メンバー抽選BGM: 音量が 0 まで下がらない").toBeDefined();
    expect(f.zeroAt! - f.startAt!, "フェードの長さ(約1.5秒)").toBeGreaterThan(1000);
    expect(f.zeroAt! - f.startAt!).toBeLessThan(3000);
    expect(f.pauseAt, "フェードが終わってから止まる").toBeGreaterThanOrEqual(f.zeroAt!);
    expect(f.restored, "止まったあとは音量が元に戻る").toBe(1);
    // メンバー結果BGM・景品抽選BGM: フェードせず、すぐ止まる
    for (const [name, id] of [["メンバー結果BGM", result], ["景品抽選BGM", prize]] as const) {
      const mine = log.filter((x) => x.id === id);
      expect(mine.some((x) => x.e === "pause"), `${name}: 止まる`).toBe(true);
      expect(mine.filter((x) => x.e === "volume" && (x.v ?? 1) < 1), `${name}: 音量を下げない(即停止)`).toEqual([]);
    }
    const prizePause = log.find((x) => x.id === prize && x.e === "pause")!;
    expect(prizePause.t - stopClickedAt, "景品抽選BGMは、停止ボタンを押してすぐ止まる(止まる演出が終わるのを待たない)").toBeLessThan(3000);
    expect(pageErrors, "ホスト画面で例外が出た").toEqual([]);
    for (const d of [admin, host, guest]) await d.context.close();
  });
}

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
      buffer: Buffer.from(zipSync({ "prizes.csv": strToU8(["ID,名前,景品ランク,アニメーション,抽選画像,当選BGM", ...rows].join("\r\n") + "\r\n"), [`media/${WIN_BGM}`]: makeWav(TUNES.fanfare) })),
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
  await expect.poll(async () => (await audioLog(host.page)).some((x) => x.e === "play"), { message: `当選BGMが流れない。画面のエラー: ${errors()}`, timeout: 15_000 }).toBe(true);
  await expect(reel.and(host.page.locator(".spinning")), `止まる演出が終わらない。画面のエラー: ${errors()}`).toBeHidden({ timeout: 30_000 });
  const reelStoppedAt = await host.page.evaluate(() => performance.now());

  const log = await audioLog(host.page);
  const play = log.filter((x) => x.e === "play").at(-1)!;
  expect(log.filter((x) => x.e === "play" && x.loop), "当選BGMはループしない").toEqual([]);
  const f = fadeOf(log, play.id);
  expect(f.zeroAt, "当選BGMの音量が 0 まで下がる").toBeDefined();
  expect(Math.abs(f.zeroAt! - reelStoppedAt), "リールが止まる瞬間(前後1.5秒以内)に無音になる").toBeLessThan(1500);
  expect(f.zeroAt! - play.t, `再生から停止秒(${STOP_SEC}秒)ほどで無音になる`).toBeGreaterThan((STOP_SEC - 1.5) * 1000);
  expect(f.zeroAt! - play.t).toBeLessThan((STOP_SEC + 1.5) * 1000);
  expect(f.pauseAt, "無音になってから止まる").toBeGreaterThanOrEqual(f.zeroAt!);
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
  expect((await audioLog(host.page)).filter((x) => x.e === "play")).toEqual([]);
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
