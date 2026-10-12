import { acceptConfirm, createSession, expect, newDevice, nextButton, route, sampleQuiz, seedStore, test, adminRpc } from "./fixtures";
import { expectNoHorizontalOverflow, VIEWPORTS } from "./helpers/responsive";

/**
 * コントロール画面の「ワンクリックで始める」と、主ボタン(押すと何が起きるかの予告つき)。
 * 管理端末とホスト(投影)だけで、イベント名の入力や画面の直接指定をせずに、クイズとジャックポットを通せること。
 */
const sessionIds: string[] = [];
test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
});

async function scene(browser: import("@playwright/test").Browser, label: string) {
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);
  await seedStore(admin.page, "quiz-game", "QuizData", [{ id: "oc1", value: sampleQuiz("oc1", 60) }]);
  await admin.page.reload();
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  await seedStore(host.page, "quiz-game", "QuizData", [{ id: "oc1", value: sampleQuiz("oc1", 60) }]);
  return { admin, host, sessionId };
}

test.describe("コントロール画面: ワンクリック開催", () => {
  test("クイズ: 「このクイズを始める」だけでイベントが開催され、主ボタンの「次へ」だけで最後まで進み、ロビーに戻る", async ({ browser }) => {
    test.setTimeout(180_000);
    const { admin, host, sessionId } = await scene(browser, "ワンクリック(クイズ)");
    await expect(admin.page.getByTestId("now")).toContainText("待機中");
    await expect(nextButton(admin.page)).toHaveCount(0); // ロビーでは主ボタンは無い

    await admin.page.getByTestId("quiz-select").selectOption("oc1");
    await admin.page.getByTestId("start-quiz").click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/intro");
    await expect(admin.page.getByTestId("event-state")).toContainText("果物クイズ");
    await expect(admin.page.getByTestId("now")).toContainText("イントロ表示中");
    await expect(admin.page.getByTestId("next-hint")).toContainText("QR");

    await nextButton(admin.page).click(); // → QR
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/qr");
    await expect(admin.page.getByTestId("next-hint")).toContainText("回答受付");
    await nextButton(admin.page).click(); // → 出題
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/play");
    await expect(admin.page.getByTestId("now")).toContainText("回答受付中");
    await expect(nextButton(admin.page)).toHaveText(/受付を締め切る/);
    await nextButton(admin.page).click(); // 受付を締め切る
    await expect(admin.page.getByTestId("now")).toContainText("受付終了");
    await expect(admin.page.getByTestId("next-hint")).toContainText("正解");
    await nextButton(admin.page).click(); // → 正解
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/answer");
    await nextButton(admin.page).click(); // → 結果
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/result");
    await expect(host.page.getByText("全員不正解").first()).toBeVisible({ timeout: 30_000 }); // 回答者なし
    await nextButton(admin.page).click(); // 当選者なし → 景品を出さずロビーへ
    await expect.poll(() => route(host.page)).toBe(`/session/host/${sessionId}`);
    await expect(admin.page.getByTestId("now")).toContainText("待機中");

    // イベントの終了は確認が出る。キャンセルすれば続く
    await admin.page.getByTestId("end-event").click();
    await admin.page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(admin.page.getByTestId("event-state")).toContainText("開催中");
    await admin.page.getByTestId("end-event").click();
    await acceptConfirm(admin.page);
    await expect(admin.page.getByTestId("event-state")).toContainText("イベントは開催していません");

    for (const d of [admin, host]) await d.context.close();
  });

  test("ジャックポット: 「ジャックポットを始める」→ オープニング・説明を経て、主ボタンで抽選画面まで進む", async ({ browser }) => {
    test.setTimeout(180_000);
    const { admin, host } = await scene(browser, "ワンクリック(ジャックポット)");
    await admin.page.getByTestId("start-jackpot").click();
    // オープニングの演出が終わると、説明の画面へ自動で進む
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toMatch(/\/jackpot-(opening|description)$/);
    await expect(admin.page.getByTestId("event-state")).toContainText("ジャックポット抽選");
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-description");
    await expect(nextButton(admin.page)).toHaveText(/抽選を始める/);
    await nextButton(admin.page).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(admin.page.getByTestId("now")).toContainText("抽選");

    for (const d of [admin, host]) await d.context.close();
  });

  test("セッション一覧の「今すぐイベントを開催する」1回で、作成・公開・操作画面まで進み、この端末をホストにもできる", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/sessions");
    await admin.page.getByTestId("quick-start").click();
    // 別のセッションが公開中なら確認が出る(他のテストの残りがあっても通るよう、出たら承諾する)
    const ok = admin.page.getByRole("button", { name: "開催する", exact: true });
    await ok.click({ timeout: 3_000 }).catch(() => undefined);
    await admin.page.waitForURL(/#\/session\/console\/[^/]+$/);
    const sessionId = new URL(admin.page.url()).hash.split("/").pop()!;
    sessionIds.push(sessionId);

    await expect(admin.page.getByTestId("host-warning")).toBeVisible(); // ホストはまだ居ない
    await admin.page.getByTestId("open-host-here").click();
    await admin.page.waitForURL(new RegExp(`#/session/host/${sessionId}$`));
    await expect(admin.page.locator(".host-view__title")).toContainText("イベント");
    void request;
    await admin.context.close();
  });

  test("スマホ幅でもコントロール画面が横にはみ出さず、主な操作が見える", async ({ browser }) => {
    const { admin, host } = await scene(browser, "ワンクリック(スマホ)");
    await admin.page.setViewportSize(VIEWPORTS.phone);
    await expect(admin.page.getByTestId("start-quiz")).toBeVisible();
    await expect(admin.page.getByTestId("start-jackpot")).toBeVisible();
    await expectNoHorizontalOverflow(admin.page, "コントロール/phone");
    await admin.page.getByTestId("start-jackpot").click();
    await expect(nextButton(admin.page)).toBeVisible();
    await expectNoHorizontalOverflow(admin.page, "コントロール(進行中)/phone");
    for (const d of [admin, host]) await d.context.close();
  });
});
