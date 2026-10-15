import type { Page } from "@playwright/test";
import { adminRpc, createSession, expect, newDevice, test } from "./fixtures";
import { fakeHost } from "./helpers/fake-host";

/**
 * 参加者ポータル(スマホ)で、長い一覧(ランキング・当選履歴)を縦にスクロールして最後まで見られること。
 * 横にはみ出さないこと(participant-responsive)とは別に、「画面より長い内容がスクロールできる」ことを確かめる。
 */

const ids = ["sc-e2e-01"];
const keys = new Map<string, string>();
const sessionIds: string[] = [];

test.beforeAll(async ({ request }) => {
  for (const id of ids) {
    await adminRpc(request, "accounts_addMember", { id, name: "太郎" });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

/** 指で上へスワイプしてスクロールする(タッチイベントを順に送る。スマホの実操作に近い経路)。 */
async function swipeUp(page: Page, distance = 500) {
  const cdp = await page.context().newCDPSession(page);
  const point = (y: number) => [{ x: 195, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(700) });
  for (let step = 1; step <= 10; step++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(700 - (distance * step) / 10) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

test("参加者ポータル: 長いランキングを指でスクロールして最後まで見られる", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "スクロール会場");
  sessionIds.push(sessionId);
  await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });
  const host = await fakeHost(request, sessionId);
  await host.quiz({
    roundKey: "q1:live",
    quizId: "q1",
    title: "果物クイズ",
    correctNo: 2,
    closedAtMs: Date.now() - 60_000,
    answeredCount: 40,
    correct: [
      { memberId: ids[0], name: "太郎", sec: 1.2 },
      ...Array.from({ length: 30 }, (_, i) => ({ memberId: `sc-other-${i}`, name: `参加者${i}`, sec: 2 + i / 10 })),
    ],
    wrongMemberIds: [],
  });

  const d = await newDevice(browser, { mobile: true });
  const page = d.page;
  await page.goto(`/#/login?id=${encodeURIComponent(ids[0])}&key=${encodeURIComponent(keys.get(ids[0])!)}`);
  await expect(page.getByTestId("home-greeting")).toBeVisible();
  await page.getByRole("link", { name: "結果" }).click();
  await expect(page.getByTestId("results-cumulative")).toBeVisible({ timeout: 15_000 });

  // 画面より長い内容があり、ページ全体がスクロールを許している
  const state = await page.evaluate(() => ({
    scrollable: document.scrollingElement!.scrollHeight > document.scrollingElement!.clientHeight,
    bodyOverflow: getComputedStyle(document.body).overflow,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
  }));
  expect(state.scrollable).toBe(true);
  expect(state.bodyOverflow).not.toBe("hidden");
  expect(state.htmlOverflow).not.toBe("hidden");

  // 指でスワイプすると動く
  expect(await scrollY(page)).toBe(0);
  await swipeUp(page);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(100);

  // 最後まで行ける: 末尾が固定のタブバーに隠れず見える
  for (let i = 0; i < 8; i++) await swipeUp(page, 800);
  const last = page.getByTestId("results-cumulative").locator("li").last();
  const [lastBox, tabsBox] = [await last.boundingBox(), await page.locator(".pp-tabs").boundingBox()];
  expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(tabsBox!.y);
});
