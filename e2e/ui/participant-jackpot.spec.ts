import type { APIRequestContext } from "@playwright/test";
import { adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, route, seedStore, test } from "./fixtures";

/**
 * エントリー受付 → ジャックポットの抽選。エントリーした人だけが抽選の対象になる。
 * エントリー者を1人に絞ると当選者が決まるので、「対象外の人が当選しない」ことを決定的に確かめられる
 * （全メンバーから引いていれば、6人中5人は別の人が当選する）。
 * 参加者は別々のブラウザコンテキスト(= 別々のスマホ)。参加者・セッションは各テストの中で作り、終わったら消す。
 */

const ALL = 6;
const ids = Array.from({ length: ALL }, (_, i) => `jp-e2e-${String(i + 1).padStart(2, "0")}`);
const keys = new Map<string, string>();
const sessionIds: string[] = [];

const qrUrl = (id: string) => `/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(keys.get(id)!)}`;
const nameOf = (id: string) => `参加者${id.slice(-2)}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  // ジャックポットの名簿は、アカウントの名簿から取り込まれる（ホストを開く前に作っておく）
  for (const id of ids) {
    await adminRpc(request, "accounts_addMember", { id, name: nameOf(id) });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

const publish = (request: APIRequestContext, sessionId: string, published = true) =>
  adminRpc(request, "sessionHub_setPortalSession", { sessionId, published });

const PRIZES = ["特賞", "一等", "二等", "三等", "四等"].map((name, i) => ({ id: `jp-p${i + 1}`, name, order: i + 1, weight: 10 }));

/** 1回の抽選を最後まで進め、当選者の名前を返す（管理コンソールの「次へ」で進める）。 */
async function drawOnce(admin: import("@playwright/test").Page): Promise<string> {
  await openAdvanced(admin);
  await admin.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect(admin.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
  for (let i = 0; i < 30; i++) {
    const state = await admin.getByTestId("jackpot-state").innerText();
    const m = /当選者: (参加者\d\d)/.exec(state);
    if (m) return m[1];
    await nextButton(admin).click();
    await admin.waitForTimeout(1500);
  }
  await expect(admin.getByTestId("jackpot-state")).toContainText(/当選者: 参加者\d\d/, { timeout: 60_000 });
  return /当選者: (参加者\d\d)/.exec(await admin.getByTestId("jackpot-state").innerText())![1];
}

async function scene(browser: import("@playwright/test").Browser, request: APIRequestContext, label: string, entrantIndexes: number[]) {
  test.setTimeout(240_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss()); // 想定外の alert で止まらないように
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toContainText(label);
  await seedStore(host.page, "jackpot-game", "PrizeData", PRIZES.map((p) => ({ id: p.id, value: p })));
  await publish(request, sessionId);

  await openAdvanced(admin.page);
  await admin.page.getByTestId("event-title").fill("ジャックポット抽選");
  await admin.page.getByRole("button", { name: "イベントを開始" }).click();
  await expect(admin.page.getByTestId("event-state")).toContainText("ジャックポット抽選");
  await admin.page.getByRole("button", { name: "エントリー受付を開始" }).click();
  await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人だけ");

  // 参加者が全員ログインし、決めた人だけがエントリーする
  const guests = await Promise.all(ids.map(() => newDevice(browser, { mobile: true })));
  await Promise.all(guests.map((g, i) => g.page.goto(qrUrl(ids[i]))));
  for (const [i, g] of guests.entries()) await expect(g.page.getByTestId("event-banner"), ids[i]).toBeVisible();
  for (const i of entrantIndexes) {
    await guests[i].page.getByTestId("event-banner").click();
    await guests[i].page.getByTestId("entry-button").click();
    await expect(guests[i].page.getByTestId("entry-done")).toBeVisible();
  }
  await expect(admin.page.getByTestId("entry-count")).toHaveText(`${entrantIndexes.length}`);
  await expect(admin.page.getByTestId("pool-state")).toContainText(`エントリーした人だけ(${entrantIndexes.length}人)`);
  return { admin, host, guests, sessionId };
}

test.describe("エントリー → ジャックポット", () => {
  test("エントリーした人だけが抽選の対象になり、エントリーしていない人は当選しない", async ({ browser, request }) => {
    const entrant = 3;
    const { admin, host, guests, sessionId } = await scene(browser, request, "抽選会場A", [entrant]);
    await admin.page.getByRole("button", { name: "エントリーを締め切る" }).click();
    await expect(admin.page.getByTestId("entry-state")).toContainText("エントリー受付は終了");

    const winner = await drawOnce(admin.page);
    expect(winner).toBe(nameOf(ids[entrant]));
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");

    // エントリー済みの当選者のスマホには「あたりました!」が全面に出る。ほかの人には当選者名が出て、演出は出ない
    const won = guests[entrant].page;
    await expect(won.getByTestId("you-won")).toBeVisible();
    await expect(won.getByTestId("you-won-name")).toContainText(winner);
    await won.getByTestId("you-won-close").click();
    await expect(won.getByTestId("you-won")).toBeHidden();
    const other = guests[(entrant + 1) % ALL].page;
    await expect(other.getByTestId("winner-member")).toContainText(winner);
    await expect(other.getByTestId("you-won")).toBeHidden();

    await publish(request, sessionId, false);
    for (const d of [admin, host, ...guests]) await d.context.close();
  });

  test("別のエントリー者でも、そのエントリー者だけが当選する（締め切る前でも対象は最新）", async ({ browser, request }) => {
    const entrant = 1;
    const { admin, host, guests, sessionId } = await scene(browser, request, "抽選会場B", [entrant]);
    // 受付中のまま抽選する（対象は、その時点のエントリー者）
    const winner = await drawOnce(admin.page);
    expect(winner).toBe(nameOf(ids[entrant]));

    await publish(request, sessionId, false);
    for (const d of [admin, host, ...guests]) await d.context.close();
  });

  test("「全メンバー」に切り替えると、エントリーしていない人も抽選の対象になる（画面の表示が切り替わる）", async ({ browser, request }) => {
    const { admin, host, guests, sessionId } = await scene(browser, request, "抽選会場C", [0]);
    await admin.page.getByRole("button", { name: "全メンバーに切り替える" }).click();
    await expect(admin.page.getByTestId("pool-state")).toContainText("全メンバー");
    await admin.page.getByRole("button", { name: "エントリーした人だけに切り替える" }).click();
    await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人だけ(1人)");

    await publish(request, sessionId, false);
    for (const d of [admin, host, ...guests]) await d.context.close();
  });

  test("メンバー抽選では参加者のスマホに停止ボタンが出ず(管理端末が止める)、景品抽選ではスマホから止められる", async ({ browser, request }) => {
    test.setTimeout(240_000);
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, "抽選会場D");
    sessionIds.push(sessionId);
    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss());
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toContainText("抽選会場D");
    await seedStore(host.page, "jackpot-game", "PrizeData", PRIZES.map((p) => ({ id: p.id, value: p })));
    await publish(request, sessionId);

    const phone = await newDevice(browser, { mobile: true });
    await phone.page.goto(qrUrl(ids[2]));
    await expect(phone.page.getByTestId("portal-conn")).toContainText("接続中");

    await openAdvanced(admin.page);
    await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
    // まだ当選者は公開されない
    await expect(phone.page.getByTestId("winner")).toBeHidden();

    // メンバー抽選は管理端末だけが進行・停止する。スマホには停止ボタンが一度も出ない。
    // （名簿には他のテストが残したメンバーもいるので、当選者の名前は決め打ちしない）
    const stopBtn = phone.page.getByRole("button", { name: "ルーレットを止める" });
    for (let i = 0; i < 30; i++) {
      const state = await admin.page.getByTestId("jackpot-state").innerText();
      if (/当選者: [^—\s]\S*/.test(state)) break;
      await expect(stopBtn).toBeHidden();
      await nextButton(admin.page).click();
      await admin.page.waitForTimeout(1500);
    }
    await expect(admin.page.getByTestId("jackpot-state")).toContainText(/当選者: [^—\s]\S*/, { timeout: 60_000 });
    await expect(phone.page.getByTestId("winner")).toContainText(/当選者: [^—\s]\S*/);

    // 景品抽選では、止められる場面でスマホに停止ボタンが出る → スマホで止める
    let phoneStopped = false;
    for (let i = 0; i < 30 && !phoneStopped; i++) {
      // 自分が当選していると「あたりました!」が全面に出ているので、閉じてから操作する
      const close = phone.page.getByTestId("you-won-close");
      if (await close.isVisible().catch(() => false)) await close.click();
      if (await stopBtn.isVisible().catch(() => false)) {
        await stopBtn.click();
        phoneStopped = true;
      } else {
        await nextButton(admin.page).click();
      }
      await admin.page.waitForTimeout(1500);
    }
    expect(phoneStopped).toBe(true);

    // 当選者と賞品の両方が画面に見えた後に、結果がサーバー(R2)へ保存される(参加者ポータルの「当選履歴」の元データ)。
    // 演出の途中では保存されない(ネタバレ防止)ので、賞品まで「次へ」で進める。
    type Results = { jackpot: { draws: Array<{ prizeName: string; memberName: string }> } };
    const drawsSaved = async () => (await adminRpc<Results>(request, "sessionHub_getResults", { sessionId })).jackpot.draws;
    for (let i = 0; i < 30 && (await drawsSaved()).length === 0; i++) {
      await nextButton(admin.page).click();
      await admin.page.waitForTimeout(1500);
    }
    const saved = await drawsSaved();
    expect(saved.length).toBeGreaterThanOrEqual(1);
    expect(saved[0].prizeName).toBeTruthy();
    expect(saved[0].memberName).toBeTruthy();

    await publish(request, sessionId, false);
    for (const d of [admin, host, phone]) await d.context.close();
  });
});
