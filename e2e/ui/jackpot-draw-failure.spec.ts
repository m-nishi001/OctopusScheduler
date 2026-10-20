import { adminRpc, createSession, expect, newDevice, nextButton, route, seedStore, test } from "./fixtures";

/**
 * 抽選に失敗したとき(ここでは、エントリーした人が1人もいない)に、ホストの画面が固まらないこと。
 * 以前は失敗後も壊れた手順が積まれ、景品抽選で null 参照の例外が出てホストが固まった。
 * 失敗はアラートで知らせ、「次へ」を押すたびに抽選をやり直すこと(原因が直れば進める)。
 */

const sessionIds: string[] = [];
test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
});

test("エントリー者がいなくて抽選に失敗しても、ホストは固まらず、「次へ」で抽選をやり直し続けられる", async ({ browser }) => {
  test.setTimeout(180_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "抽選失敗からの復帰");
  sessionIds.push(sessionId);

  const host = await newDevice(browser, { signedIn: true, projector: true });
  const alerts: string[] = [];
  const pageErrors: string[] = [];
  host.page.on("dialog", (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  host.page.on("console", (m) => {
    if (m.type() === "error") pageErrors.push(m.text());
  });
  host.page.on("pageerror", (e) => pageErrors.push(String(e)));
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();

  await seedStore(host.page, "jackpot-game", "PrizeData", [
    { id: "jp-fail-prize-1", value: { id: "jp-fail-prize-1", name: "特賞", order: 1, weight: 10, animation: "roulette" } },
    { id: "jp-fail-prize-2", value: { id: "jp-fail-prize-2", name: "一等", order: 2, weight: 10, animation: "roulette" } },
  ]);

  // ジャックポットを始める(エントリー受付が始まるが、誰もエントリーしない)→ 説明 → 抽選画面
  await admin.page.getByTestId("start-jackpot").click();
  await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-description");
  const next = nextButton(admin.page);
  // 説明のスライドを最後まで進める（最後の1枚の次が「抽選を始める」）
  for (let i = 0; i < 10; i++) {
    const label = await next.innerText();
    if (/抽選を始める/.test(label)) break;
    await next.click();
    await expect(next).not.toHaveText(label); // 1枚進んでから次を押す（押しすぎて抽選画面に進まないように）
  }
  await expect(next).toHaveText(/抽選を始める/);
  // 押したコマンドが(通信の都合などで)処理されなかったときのために、抽選画面に進むまで押し直す。
  // 進んだあとの追加の「次へ」は、この先の確認(失敗しても固まらず、やり直せる)の妨げにならない。
  await expect(async () => {
    await next.click();
    await expect.poll(() => route(host.page), { timeout: 5_000 }).toBe("/execute/jackpot-draw");
  }).toPass({ timeout: 45_000 });

  // 1. 抽選に失敗: アラートで知らせる
  await expect.poll(() => alerts.length, { timeout: 60_000 }).toBeGreaterThan(0);
  expect(alerts[0]).toContain("抽選の対象のメンバーがいません");

  // 2. 「次へ」を押すたびに、抽選をやり直して(失敗するたびに)知らせる。壊れた手順は実行されない
  for (let i = 1; i <= 3; i++) {
    await next.click();
    await expect.poll(() => alerts.length, { timeout: 30_000 }).toBeGreaterThan(i);
  }
  expect(pageErrors.filter((e) => /Cannot read properties of null/.test(e)), "null 参照の例外が出ていない").toEqual([]);
  await expect(host.page.getByText("準備中...")).toBeVisible(); // メンバー抽選・景品抽選の演出には進まない

  for (const d of [admin, host]) await d.context.close();
});
