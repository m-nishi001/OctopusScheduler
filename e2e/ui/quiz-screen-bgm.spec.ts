import { strToU8, zipSync } from "fflate";
import type { Page } from "@playwright/test";
import { makeWav, TUNES } from "../../scripts/seed-content.js";
import { adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, route, test } from "./fixtures";

/**
 * クイズの開始BGM(イントロ画面)とランキングBGM(ランキング画面)。どちらも1回だけ流し(ループしない)、画面を離れたら止める。
 * 音は <audio> の play / pause のイベントで確かめる。音源はテストの中で生成する(公開リポジトリのため)。
 */

const stamp = Date.now();
const QUIZ_ID = `qz-bgm-${stamp}`;
const INTRO_BGM = `qz-intro-${stamp}.wav`;
const RANKING_BGM = `qz-ranking-${stamp}.wav`;
const sessionIds: string[] = [];

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
});

type AudioEvent = { e: "play" | "pause"; id: number; loop: boolean };
async function installAudioLog(page: Page) {
  await page.context().addInitScript(() => {
    const log: AudioEvent[] = [];
    (window as unknown as { __audioLog: AudioEvent[] }).__audioLog = log;
    const ids = new WeakMap<object, number>();
    let count = 0;
    const idOf = (el: object) => {
      if (!ids.has(el)) ids.set(el, ++count);
      return ids.get(el)!;
    };
    const proto = HTMLMediaElement.prototype;
    const play = proto.play;
    proto.play = function (this: HTMLMediaElement) {
      log.push({ e: "play", id: idOf(this), loop: this.loop });
      return play.call(this);
    };
    const pause = proto.pause;
    proto.pause = function (this: HTMLMediaElement) {
      log.push({ e: "pause", id: idOf(this), loop: this.loop });
      return pause.call(this);
    };
  });
}
const audioLog = (page: Page) => page.evaluate(() => (window as unknown as { __audioLog: AudioEvent[] }).__audioLog);

const quizzesZip = () => {
  const header = "ID,タイトル,問題,制限時間(秒),正解(選択肢の番号),開始BGM,ランキングBGM,選択肢1,選択肢2";
  const row = `${QUIZ_ID},BGMクイズ,みかんはどれ?,30,2,${INTRO_BGM},${RANKING_BGM},りんご,みかん`;
  return {
    name: "quizzes.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(
      zipSync({
        "quizzes.csv": strToU8(`${header}\r\n${row}\r\n`),
        [`media/${INTRO_BGM}`]: makeWav(TUNES.opening),
        [`media/${RANKING_BGM}`]: makeWav(TUNES.ending),
      })
    ),
  };
};

test("@motion クイズの開始BGM・ランキングBGMは、その画面で1回だけ流れ(ループしない)、画面を離れたら止まる", async ({ browser }) => {
  test.setTimeout(240_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "クイズBGM");
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await installAudioLog(host.page);
  const pageErrors: string[] = [];
  host.page.on("pageerror", (e) => pageErrors.push(e.message));

  // クイズを素材つきで取り込む(開始BGM・ランキングBGM)。素材は端末ごとに持つので、ホスト(投影)の端末でも取り込む
  for (const page of [admin.page, host.page]) {
    await page.goto("/#/quiz-admin");
    await expect(page.getByTestId("table-export")).toBeVisible();
    await page.getByTestId("table-import-open").click();
    await page.getByTestId("table-import-table").setInputFiles(quizzesZip());
    await expect(page.getByTestId("table-import-counts")).toContainText("エラー 0");
    const apply = page.getByRole("dialog").getByRole("button", { name: "取り込む" });
    if (await apply.isEnabled()) {
      await apply.click();
      await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
      await page.getByTestId("table-import-close").click();
    } else {
      await page.getByRole("button", { name: "閉じる" }).click(); // すでに取り込み済み(変更なし)
    }
  }

  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  // 管理端末: 作ったセッションの操作画面に戻って、クイズを選ぶ
  await admin.page.goto(`/#/session/console/${sessionId}`);
  await expect(admin.page.getByTestId("quiz-select")).toBeVisible({ timeout: 30_000 });
  await admin.page.getByTestId("quiz-select").selectOption(QUIZ_ID);
  await openAdvanced(admin.page);

  // イントロ: 開始BGMが1回だけ流れる
  await admin.page.getByTestId("advanced").getByRole("button", { name: "イントロ" }).click();
  await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${QUIZ_ID}/intro`);
  await expect.poll(async () => (await audioLog(host.page)).filter((x) => x.e === "play").length, { message: "開始BGMが流れる", timeout: 30_000 }).toBe(1);
  const intro = (await audioLog(host.page)).find((x) => x.e === "play")!;
  expect(intro.loop, "開始BGMはループしない").toBe(false);

  // イントロを離れる(出題へ)と止まる
  await admin.page.getByTestId("advanced").getByRole("button", { name: "出題" }).click();
  await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${QUIZ_ID}/play`);
  await expect.poll(async () => (await audioLog(host.page)).some((x) => x.e === "pause" && x.id === intro.id), { message: "イントロを離れたら止まる" }).toBe(true);

  // 締切 → 正解 → ランキング: ランキングBGMが1回だけ流れる
  const next = nextButton(admin.page);
  await next.click(); // 受付を締め切る
  await expect(host.page.getByText("受付を終了しました")).toBeVisible({ timeout: 30_000 });
  await expect(next).not.toContainText("締め切る");
  await next.click(); // → 正解
  await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${QUIZ_ID}/answer`);
  await next.click(); // → ランキング
  await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${QUIZ_ID}/result`);
  await expect
    .poll(async () => (await audioLog(host.page)).filter((x) => x.e === "play" && x.id !== intro.id).length, { message: "ランキングBGMが流れる", timeout: 30_000 })
    .toBe(1);
  const ranking = (await audioLog(host.page)).filter((x) => x.e === "play").at(-1)!;
  expect(ranking.loop, "ランキングBGMはループしない").toBe(false);
  expect(ranking.id).not.toBe(intro.id);

  // ランキングを離れる(ロビーへ)と止まる
  await expect(host.page.getByText("全員不正解").first()).toBeVisible({ timeout: 30_000 });
  await next.click();
  await expect.poll(() => route(host.page)).toBe(`/session/host/${sessionId}`);
  await expect.poll(async () => (await audioLog(host.page)).some((x) => x.e === "pause" && x.id === ranking.id), { message: "ランキングを離れたら止まる" }).toBe(true);
  expect(pageErrors).toEqual([]);
  for (const d of [admin, host]) await d.context.close();
});
