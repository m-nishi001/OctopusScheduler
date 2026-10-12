import { adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, seedStore, test } from "./fixtures";
import { captureTimeline, expectAnimating } from "./helpers/motion";

/**
 * 景品抽選（ルーレット / スロット）が、開始で回り始め、停止で止まること。
 * 以前、スロットは開始しても何も動かない不具合があった（親から startSpin/stopSpin が見えなかった）。
 * 回転は画面の見た目で確認する: 回転中はスクリーンショットが毎回変わり、止めると回転が終わって当選が発表される。
 */

const MEMBER = { id: "jp-draw-e2e-01", name: "抽選太郎" };
const sessionIds: string[] = [];

test.beforeAll(async ({ request }) => {
  await adminRpc(request, "accounts_addMember", MEMBER);
});
test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  await adminRpc(request, "accounts_deleteMember", { id: MEMBER.id });
});

for (const kind of ["roulette", "slot"] as const) {
  test(`@motion 景品抽選(${kind}): 開始で回り始め、停止で止まる`, async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, `景品抽選-${kind}`);
    sessionIds.push(sessionId);
    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss());
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();
    const prizes = ["特賞", "一等", "二等", "三等", "四等"].map((name, i) => ({
      id: `jp-draw-${kind}-${i + 1}`,
      name,
      order: i + 1,
      weight: 10,
      animation: kind,
    }));
    await seedStore(host.page, "jackpot-game", "PrizeData", prizes.map((p) => ({ id: p.id, value: p })));

    await openAdvanced(admin.page);
    await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
    const state = admin.page.getByTestId("jackpot-state");
    await expect(state).toContainText("メンバー抽選", { timeout: 60_000 });
    const next = nextButton(admin.page);

    // 景品抽選の画面になるまで「次へ」で進める
    const reel = host.page.locator(kind === "slot" ? ".slot-container" : ".roulette-container");
    for (let i = 0; i < 30 && !(await reel.isVisible().catch(() => false)); i++) {
      await next.click();
      await admin.page.waitForTimeout(1500);
    }
    await expect(reel).toBeVisible();

    // 回り始めるまで進める（開始の直前に「待機」の手順があるため、1回で始まるとは限らない）
    const spinning = host.page.locator(`${kind === "slot" ? ".slot-container" : ".roulette-container"}.spinning`);
    for (let i = 0; i < 5 && !(await spinning.isVisible().catch(() => false)); i++) {
      await next.click();
      await admin.page.waitForTimeout(1500);
    }
    await expect(spinning, "「次へ」を押しても景品抽選が回り始めない").toBeVisible();
    await expectAnimating(reel, `prize-${kind}-spinning`, { count: 4, intervalMs: 400 });

    // 止める → 回転が止まり、当選した景品が発表される（発表の紙吹雪は動き続けるので、静止ではなく発表の表示で確認する）
    await next.click();
    await expect(spinning).toBeHidden({ timeout: 30_000 });
    await expect(host.page.getByText("景品当選")).toBeVisible({ timeout: 30_000 });
    await captureTimeline(host.page, `prize-${kind}-stopped`, { count: 2, intervalMs: 500 });

    for (const d of [admin, host]) await d.context.close();
  });
}
