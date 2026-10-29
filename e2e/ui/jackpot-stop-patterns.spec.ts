import type { Page } from "@playwright/test";
import { adminRpc, createSession, expect, joinPortalAs, newDevice, nextButton, openAdvanced, seedStore, test } from "./fixtures";
import { changedFrames, captureTimeline } from "./helpers/motion";
import { sampleRepeatedRows, stoppedWinRows } from "./helpers/slot";

/**
 * ルーレット・メンバー抽選の「意地悪な止まり方」が、ホスト画面で実際に動き、最後は必ず当選が発表されること。
 * 止まり方は乱数で選ばれるので、止める直前にホスト画面の Math.random を固定して、止まり方を1つずつ強制する。
 *   ルーレット: 〜0.34 normal / 〜0.52 overshoot / 〜0.68 creep / 〜0.84 fakeout / それ以上 nearMiss
 *   メンバー  : 〜0.22 smooth / 〜0.36 bounce / 〜0.50 swing / 〜0.68 nearMiss / 〜0.84 creep / それ以上 fakeout
 * 見ること: 演出が動く(画面が変化する)・固まらない(規定の時間内に終わる)・例外が出ない・当選の発表まで進む。
 */

const MEMBER = { id: "jp-stop-e2e-01", name: "停止太郎" };
const sessionIds: string[] = [];
let memberKey = "";

test.beforeAll(async ({ request }) => {
  await adminRpc(request, "accounts_addMember", MEMBER);
  memberKey = (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id: MEMBER.id })).key;
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

async function scene(browser: import("@playwright/test").Browser, request: import("@playwright/test").APIRequestContext, label: string, kind: "roulette" | "slot") {
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
  // 抽選の対象は既定で「参加者全員(自動)」: ポータルから入室した人を1人用意する
  const guest = await joinPortalAs(browser, request, sessionId, MEMBER.id, memberKey);
  await openAdvanced(admin.page);
  await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
  return { admin, host, guest, pageErrors, patterns };
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
    // 演出中は主ボタンが「演出中…」で押せない。終わるのを待ってから見る(待たずに押すと、次に押せる状態になった瞬間に意図しない操作を送ってしまう)
    await expect(next).not.toContainText("演出中", { timeout: 30_000 });
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
  test(`@motion ルーレットの止まり方(${pattern.name}): 動いて、固まらず、当選が発表される`, async ({ browser, request }) => {
    test.setTimeout(300_000);
    const { admin, host, guest, pageErrors, patterns } = await scene(browser, request, `止まり方-${pattern.name}`, "roulette");
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
    for (const d of [admin, host, guest]) await d.context.close();
  });
}

// 止める操作の直後(停止の演出中)は、ホストが「演出中」を公開して、管理端末の主ボタンと参加者の停止ボタンを押せなくする。
// 演出が終わった直後に滑り込んだ操作が、当選の画面を閉じて飛ばしてしまわないこと(今回の不具合)。
test("@motion 停止の演出中は、参加者の停止ボタンが消え、管理端末の主ボタンが「演出中…」で押せず、連打しても当選の画面を飛ばさない", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const { admin, host, guest, pageErrors } = await scene(browser, request, "停止の二重押し", "roulette");
  const spinning = host.page.locator(".roulette-container.spinning");
  const portalStop = guest.page.getByTestId("client-input");
  await guest.page.goto("/#/p/event");

  await advanceUntilStop(admin.page, "景品");
  await expect(spinning, "止める時点で回っている").toBeVisible();
  // 景品抽選の停止は、当選した本人(参加者1人)のスマホにも出る
  await expect(portalStop).toBeVisible({ timeout: 30_000 });

  await forceRandom(host.page, 0.1);
  await nextButton(admin.page).click();
  // 演出中: 参加者の停止ボタンはすぐ消え、管理端末の主ボタンは「演出中…」で押せない
  await expect(nextButton(admin.page)).toContainText("演出中…", { timeout: 10_000 });
  await expect(nextButton(admin.page)).toBeDisabled();
  await expect(portalStop).toHaveCount(0, { timeout: 10_000 });

  // 演出が終わるまで両方を連打する(無効なボタンへの force クリックと、消えた停止ボタンへのタップ)
  const settled = spinning.waitFor({ state: "hidden", timeout: 30_000 });
  let done = false;
  void settled.then(() => (done = true));
  for (let i = 0; i < 5 && !done; i++) {
    await nextButton(admin.page).click({ force: true, timeout: 1000 }).catch(() => undefined);
    await portalStop.tap({ force: true, timeout: 300 }).catch(() => undefined);
  }
  await settled;
  const dialog = host.page.getByText("景品当選");
  await expect(dialog, "連打しても当選の画面は閉じない").toBeVisible({ timeout: 30_000 });
  await restoreRandom(host.page);

  // 演出が終わったら、管理端末は「次へ」に戻り、押すと当選の画面を閉じて進める
  await expect(admin.page.getByTestId("jackpot-state")).toContainText(/当選者: [^—\s]\S*/);
  await expect(nextButton(admin.page)).toBeEnabled({ timeout: 30_000 });
  await expect(nextButton(admin.page)).not.toContainText("演出中");
  await expect(dialog).toBeVisible();
  await nextButton(admin.page).click();
  await expect(dialog, "演出が終わったあとの「次へ」は効く").toBeHidden({ timeout: 30_000 });
  expect(pageErrors, "ホスト画面で例外が出た").toEqual([]);
  for (const d of [admin, host, guest]) await d.context.close();
});

// スロット: 乱数を固定しても(並びの作り方が偏る極端な値でも)、回っている間も減速して止まるまでも、
// 窓に見える景品が同じ名前で続かず、固まらず、最後は3本とも当選景品で止まって発表される。
// 乱数は景品の並びを作る回転の開始前に固定する(並びは回し始めるたびに組み直される)。
const SLOT_RANDOMS = [0, 0.5, 0.999] as const;
for (const random of SLOT_RANDOMS) {
  test(`@motion スロットの止まり方(乱数${random}): 同じ景品名が続けて見えず、減速して、3本とも当選景品で止まる`, async ({ browser, request }) => {
    test.setTimeout(300_000);
    const { admin, host, guest, pageErrors } = await scene(browser, request, `スロット止まり方-${random}`, "slot");
    const reel = host.page.locator(".slot-container");
    const spinning = host.page.locator(".slot-container.spinning");

    await forceRandom(host.page, random);
    await advanceUntilStop(admin.page, "景品");
    await expect(spinning, "止める時点で回っている").toBeVisible();
    expect(await sampleRepeatedRows(host.page, 120), "回転中に同じ景品名が続けて見えた").toEqual([]);

    // 止める操作の直後から、減速して止まるまでの窓も見る
    const duringStop = sampleRepeatedRows(host.page, 200);
    const clicked = Date.now();
    await nextButton(admin.page).click();
    const frames = await captureTimeline(reel, `stop-slot-${random}`, { count: 8, intervalMs: 400 });
    expect(changedFrames(frames), "止まる演出が動いていない").toBeGreaterThanOrEqual(2);
    expect(await duringStop, "減速中に同じ景品名が続けて見えた").toEqual([]);

    await expect(spinning).toBeHidden({ timeout: 30_000 });
    // 既定は停止から4秒で止まる(通信の遅れを見込んで余裕を持たせる)
    expect(Date.now() - clicked, "止まるまでが長すぎる").toBeLessThan(15_000);
    expect(Date.now() - clicked, "止まるまでが短すぎる(旧: 約2.3秒)").toBeGreaterThan(3000);
    const rows = await stoppedWinRows(host.page);
    expect(new Set(rows).size, `3本のリールが当たりの行(真ん中)に同じ景品で止まる: ${rows.join(",")}`).toBe(1);
    await expect(host.page.getByText("景品当選")).toBeVisible({ timeout: 30_000 });
    await expect(host.page.getByTestId("prize-winning-name")).toHaveText(rows[0]);
    await restoreRandom(host.page);

    await expect(admin.page.getByTestId("jackpot-state")).toContainText(/当選者: [^—\s]\S*/);
    expect(pageErrors, "ホスト画面で例外が出た").toEqual([]);
    for (const d of [admin, host, guest]) await d.context.close();
  });
}

for (const pattern of MEMBER_PATTERNS) {
  test(`@motion メンバー抽選の止まり方(${pattern.name}): 動いて、固まらず、当選者が発表される`, async ({ browser, request }) => {
    test.setTimeout(300_000);
    const { admin, host, guest, pageErrors, patterns } = await scene(browser, request, `メンバー止まり方-${pattern.name}`, "roulette");
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
    for (const d of [admin, host, guest]) await d.context.close();
  });
}
