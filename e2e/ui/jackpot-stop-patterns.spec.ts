import type { Page } from "@playwright/test";
import { adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, seedStore, test } from "./fixtures";
import { changedFrames, captureTimeline } from "./helpers/motion";

/**
 * ルーレット・メンバー抽選の「意地悪な止まり方」が、ホスト画面で実際に動き、最後は必ず当選が発表されること。
 * 止まり方は乱数で選ばれるので、止める直前にホスト画面の Math.random を固定して、止まり方を1つずつ強制する。
 *   ルーレット: 〜0.34 normal / 〜0.52 overshoot / 〜0.68 creep / 〜0.84 fakeout / それ以上 nearMiss
 *   メンバー  : 〜0.22 smooth / 〜0.36 bounce / 〜0.50 swing / 〜0.68 nearMiss / 〜0.84 creep / それ以上 fakeout
 * 見ること: 演出が動く(画面が変化する)・固まらない(規定の時間内に終わる)・例外が出ない・当選の発表まで進む。
 */

const MEMBER = { id: "jp-stop-e2e-01", name: "停止太郎" };
const sessionIds: string[] = [];

test.beforeAll(async ({ request }) => {
  await adminRpc(request, "accounts_addMember", MEMBER);
});
test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  await adminRpc(request, "accounts_deleteMember", { id: MEMBER.id });
});

const ROULETTE_PATTERNS = [
  { name: "normal", random: 0.1 },
  { name: "overshoot", random: 0.4 },
  { name: "creep", random: 0.6 },
  { name: "fakeout", random: 0.75 },
  { name: "nearMiss", random: 0.92 },
] as const;

const MEMBER_PATTERNS = [
  { name: "smooth", random: 0.05 },
  { name: "bounce", random: 0.3 },
  { name: "swing", random: 0.43 },
  { name: "nearMiss", random: 0.6 },
  { name: "creep", random: 0.75 },
  { name: "fakeout", random: 0.92 },
] as const;

const forceRandom = (page: Page, value: number) =>
  page.evaluate((v) => {
    const w = window as unknown as { __origRandom?: () => number };
    w.__origRandom ??= Math.random;
    Math.random = () => v;
  }, value);
const restoreRandom = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __origRandom?: () => number };
    if (w.__origRandom) Math.random = w.__origRandom;
  });

async function scene(browser: import("@playwright/test").Browser, label: string, kind: "roulette" | "slot") {
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  const pageErrors: string[] = [];
  const patterns = { roulette: [] as string[], member: [] as string[] };
  host.page.on("pageerror", (e) => pageErrors.push(e.message));
  // 選ばれた止まり方(強制した止まり方が実際に使われたかを確かめる)
  host.page.on("console", (m) => {
    const roulette = /\[RouletteAnimation\] stop pattern\s+(\w+)/.exec(m.text());
    if (roulette) patterns.roulette.push(roulette[1]);
    const member = /\[MemberDrawAnimation\] stopAt: pattern\s+(\w+)/.exec(m.text());
    if (member) patterns.member.push(member[1]);
  });
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  const prizes = ["特賞", "一等", "二等", "三等", "四等"].map((name, i) => ({ id: `jp-stop-${kind}-${i + 1}`, name, order: i + 1, weight: 10, animation: kind }));
  await seedStore(host.page, "jackpot-game", "PrizeData", prizes.map((p) => ({ id: p.id, value: p })));
  await openAdvanced(admin.page);
  await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
  return { admin, host, pageErrors, patterns };
}

/**
 * 管理コンソールの主ボタンが「止める」(指定の種類)になるまで「次へ」で進める。
 * 押したあとは、管理端末の表示(主ボタン・予告・状態)が変わるのを待ってから次を押す。通信に時間がかかる環境では、
 * 表示が変わる前に押し直すと、回し始めた直後の抽選を意図せず止めてしまい、強制した止まり方にならない。
 */
async function advanceUntilStop(admin: Page, what: "メンバー" | "景品") {
  const next = nextButton(admin);
  const view = async () =>
    [await next.innerText().catch(() => ""), await admin.getByTestId("next-hint").innerText().catch(() => ""), await admin.getByTestId("jackpot-state").innerText().catch(() => "")].join("|");
  for (let i = 0; i < 40; i++) {
    const label = (await next.innerText().catch(() => "")).trim();
    const hint = (await admin.getByTestId("next-hint").innerText().catch(() => "")).trim();
    if (label.includes("止める") && hint.includes(what)) return;
    const before = await view();
    await next.click();
    await expect.poll(view, { timeout: 20_000 }).not.toBe(before);
  }
  throw new Error(`${what}を止められる状態にならなかった`);
}

for (const pattern of ROULETTE_PATTERNS) {
  test(`@motion ルーレットの止まり方(${pattern.name}): 動いて、固まらず、当選が発表される`, async ({ browser }) => {
    test.setTimeout(300_000);
    const { admin, host, pageErrors, patterns } = await scene(browser, `止まり方-${pattern.name}`, "roulette");
    const reel = host.page.locator(".roulette-container");
    const spinning = host.page.locator(".roulette-container.spinning");

    await advanceUntilStop(admin.page, "景品");
    await expect(spinning, "止める時点で回っている").toBeVisible();

    await forceRandom(host.page, pattern.random);
    const clicked = Date.now();
    await nextButton(admin.page).click();
    // 止まり方の途中(止まったように見える間も含む)を撮る。回っている間に、画面が何度か変化している
    const frames = await captureTimeline(reel, `stop-roulette-${pattern.name}`, { count: 8, intervalMs: 500 });
    expect(changedFrames(frames), `${pattern.name}: 止まる演出が動いていない`).toBeGreaterThanOrEqual(2);

    await expect(spinning).toBeHidden({ timeout: 30_000 });
    // どの止まり方でも、規定の時間(3秒の指定 × 最大1.7倍 + 余裕)で終わる
    expect(Date.now() - clicked, `${pattern.name}: 止まるまでが長すぎる`).toBeLessThan(15_000);
    await expect(host.page.getByText("景品当選")).toBeVisible({ timeout: 30_000 });
    await restoreRandom(host.page);

    // 演出のあとも、通常どおり進行できる(管理コンソールの状態が当選者・賞品を反映する)
    await expect(admin.page.getByTestId("jackpot-state")).toContainText(/当選者: [^—\s]\S*/);
    expect(patterns.roulette, `${pattern.name}: 強制した止まり方で止まっていない`).toEqual([pattern.name]);
    expect(pageErrors, `${pattern.name}: ホスト画面で例外が出た`).toEqual([]);
    for (const d of [admin, host]) await d.context.close();
  });
}

for (const pattern of MEMBER_PATTERNS) {
  test(`@motion メンバー抽選の止まり方(${pattern.name}): 動いて、固まらず、当選者が発表される`, async ({ browser }) => {
    test.setTimeout(300_000);
    const { admin, host, pageErrors, patterns } = await scene(browser, `メンバー止まり方-${pattern.name}`, "roulette");
    const viewport = host.page.locator(".member-draw .viewport");

    await advanceUntilStop(admin.page, "メンバー");
    await forceRandom(host.page, pattern.random);
    const clicked = Date.now();
    await nextButton(admin.page).click();
    const frames = await captureTimeline(viewport, `stop-member-${pattern.name}`, { count: 8, intervalMs: 500 });
    expect(changedFrames(frames), `${pattern.name}: 止まる演出が動いていない`).toBeGreaterThanOrEqual(2);

    // 当選者が公開される(= 演出が終わり、当選者が中央に止まった)
    await expect(admin.page.getByTestId("jackpot-state")).toContainText(/当選者: [^—\s]\S*/, { timeout: 30_000 });
    expect(Date.now() - clicked, `${pattern.name}: 止まるまでが長すぎる`).toBeLessThan(15_000);
    await restoreRandom(host.page);
    expect(patterns.member, `${pattern.name}: 強制した止まり方で止まっていない`).toEqual([pattern.name]);
    expect(pageErrors, `${pattern.name}: ホスト画面で例外が出た`).toEqual([]);
    for (const d of [admin, host]) await d.context.close();
  });
}
