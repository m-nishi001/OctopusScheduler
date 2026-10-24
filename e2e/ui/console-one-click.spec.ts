import { createSession, expect, isGas, newDevice, nextButton, openAdvanced, route, sampleQuiz, seedStore, test, adminRpc } from "./fixtures";
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
    await expect(admin.page.getByTestId("next-hint")).toContainText("エントリー");

    await nextButton(admin.page).click(); // → エントリー(受付が自動で始まる)
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/entry");
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付中");
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
    // クイズが終わってロビーに戻ると、イベントも自動で終了する
    await expect(admin.page.getByTestId("event-state")).toContainText("イベントは開催していません");

    for (const d of [admin, host]) await d.context.close();
  });

  test("クイズ: コントロール画面で Enter キーを押すと主ボタンと同じ操作になる(受付の締切だけは Enter では動かない)", async ({ browser }) => {
    test.setTimeout(180_000);
    const { admin, host } = await scene(browser, "Enter操作(クイズ)");
    await admin.page.getByTestId("quiz-select").selectOption("oc1");
    await admin.page.getByTestId("start-quiz").click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/intro");
    await expect(nextButton(admin.page).getByTestId("next-key")).toHaveText("Enter");
    // 開始ボタンのフォーカスを外す(ボタンにフォーカスがあるとEnterはそのボタンの操作になる)
    await admin.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await admin.page.keyboard.press("Enter"); // → エントリー
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/entry");
    await admin.page.keyboard.press("Enter"); // → 出題
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/play");
    await expect(admin.page.getByTestId("now")).toContainText("回答受付中");

    // 締切は Enter では動かない(表示も出ない)。クリックなら動く
    await expect(nextButton(admin.page)).toHaveText(/受付を締め切る/);
    await expect(admin.page.getByTestId("next-key")).toHaveCount(0);
    await admin.page.keyboard.press("Enter");
    await admin.page.waitForTimeout(1_500);
    await expect(admin.page.getByTestId("now")).toContainText("回答受付中");
    await nextButton(admin.page).click();
    await expect(admin.page.getByTestId("now")).toContainText("受付終了");

    await admin.page.keyboard.press("Enter"); // → 正解
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/oc1/answer");
    for (const d of [admin, host]) await d.context.close();
  });

  test("ジャックポット: 「ジャックポットを始める」→ オープニング → 説明を経て、主ボタンで抽選画面まで進む(参加者全員(自動)はエントリー画面を挟まない)", async ({ browser }) => {
    test.setTimeout(180_000);
    const { admin, host } = await scene(browser, "ワンクリック(ジャックポット)");
    await admin.page.getByTestId("start-jackpot").click();
    // オープニングの演出が終わると、説明へ自動で進む(抽選の対象が参加者全員(自動)なので、エントリー画面は挟まない)
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toMatch(/\/jackpot-(opening|description)$/);
    await expect(admin.page.getByTestId("event-state")).toContainText("ジャックポット抽選");
    // 開始してもエントリー受付は始まらない
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付は始まっていません");
    await expect(admin.page.getByTestId("pool-state")).toContainText("参加者全員(自動)");
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-description");
    await expect(admin.page.getByTestId("now")).toContainText("説明表示中");
    await expect(nextButton(admin.page)).toHaveText(/抽選を始める/);
    await nextButton(admin.page).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(admin.page.getByTestId("now")).toContainText("抽選");

    for (const d of [admin, host]) await d.context.close();
  });

  test("ジャックポット: 説明のスライドをコントロール画面から1枚ずつ進め/戻せる(ボタンとキー)。最後のスライドの次は抽選画面", async ({ browser }) => {
    test.setTimeout(180_000);
    const { admin, host } = await scene(browser, "説明スライド操作");
    const slides = ["一枚目の説明", "二枚目の説明", "三枚目の説明"].map((content, i) => ({ id: `s${i}`, type: "text", content }));
    const setting = {
      screenName: "description",
      settingName: "description-screen-settings",
      settingValue: JSON.stringify({ descriptionBgm: "", screenElements: slides }),
    };
    await seedStore(host.page, "jackpot-game", "ScreenConfigData", [{ id: "description_description-screen-settings", value: setting }]);
    await admin.page.getByTestId("start-jackpot").click();
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-description");
    await expect(admin.page.getByTestId("now")).toContainText("説明表示中");

    const hostText = host.page.locator("body");
    const back = admin.page.getByTestId("back-button");
    // 導入画面: 次のスライドへ。前へは無い
    await expect(nextButton(admin.page)).toHaveText(/次のスライドへ \(1\/3\)/);
    await expect(back).toHaveCount(0);
    await nextButton(admin.page).click();
    await expect(hostText).toContainText("一枚目の説明");
    await expect(admin.page.getByTestId("now")).toContainText("(1/3)");
    await expect(back).toBeVisible();

    await nextButton(admin.page).click();
    await expect(hostText).toContainText("二枚目の説明");
    await expect(admin.page.getByTestId("now")).toContainText("(2/3)");

    // 前へ(ボタン)でひとつ戻る。ホストの画面も戻る
    await back.click();
    await expect(hostText).toContainText("一枚目の説明");
    await expect(admin.page.getByTestId("now")).toContainText("(1/3)");

    // キーでも操作できる: Enter で進み、Backspace で戻る
    await admin.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    // 管理端末の表示(いま何枚目か)がホストに追いついてから次のキーを押す。通信に時間がかかる環境では、追いつく前のキーは
    // 古い状態に対する操作になり(たとえば最後のスライドだと思って「抽選を始める」を押してしまい)、期待とずれる。
    const now = admin.page.getByTestId("now");
    await admin.page.keyboard.press("Enter");
    await expect(hostText).toContainText("二枚目の説明");
    await expect(now).toContainText("(2/3)");
    await admin.page.keyboard.press("Enter");
    await expect(hostText).toContainText("三枚目の説明");
    await expect(now).toContainText("(3/3)");
    await admin.page.keyboard.press("Backspace");
    await expect(hostText).toContainText("二枚目の説明");
    await expect(now).toContainText("(2/3)");
    await admin.page.keyboard.press("Enter");
    await expect(hostText).toContainText("三枚目の説明");
    await expect(now).toContainText("(3/3)");

    // 最後のスライド: 主ボタンは「抽選を始める」。route はまだ説明のまま
    await expect(nextButton(admin.page)).toHaveText(/抽選を始める/);
    expect(await route(host.page)).toBe("/execute/jackpot-description");
    await nextButton(admin.page).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(back).toHaveCount(0);

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

  test("ジャックポット: 管理端末が古い画面を見たまま押した主ボタンは、ホストがもう進んでいれば破棄され、次の画面の操作として画面を飛ばさない", async ({ browser }) => {
    test.skip(isGas, "WebSocket の受信を止めて古い表示を作るので、ポーリングの GAS では再現できない(ホスト側のガードは単体テストで固定)");
    test.setTimeout(180_000);
    const { admin, host, sessionId } = await scene(browser, "古い主ボタン");
    // 参加者がいない抽選を進めると、ホストが「抽選の対象のメンバーがいません」と知らせる。抽選が進んだかどうかの目印にする
    const alerts: string[] = [];
    host.page.on("dialog", (d) => alerts.push(d.message()));
    const slides = ["一枚目の説明", "二枚目の説明"].map((content, i) => ({ id: `s${i}`, type: "text", content }));
    await seedStore(host.page, "jackpot-game", "ScreenConfigData", [
      {
        id: "description_description-screen-settings",
        value: { screenName: "description", settingName: "description-screen-settings", settingValue: JSON.stringify({ descriptionBgm: "", screenElements: slides }) },
      },
    ]);
    await seedStore(host.page, "jackpot-game", "PrizeData", [{ id: "stale-p1", value: { id: "stale-p1", name: "特賞", order: 1, weight: 10, animation: "roulette" } }]);

    // 管理端末1の受信を止められるようにして開き直す(止めている間は、ホストの表示が変わっても古い画面のまま)
    let frozen = false;
    await admin.page.routeWebSocket(/.*/, (ws) => {
      const server = ws.connectToServer();
      ws.onMessage((message) => server.send(message));
      server.onMessage((message) => {
        if (!frozen) ws.send(message);
      });
    });
    await admin.page.reload();
    await admin.page.getByTestId("start-jackpot").click();
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-description");
    await expect(admin.page.getByTestId("now")).toContainText("説明表示中");
    await expect(nextButton(admin.page)).toHaveText(/次のスライドへ/);

    // 管理端末2がホストを抽選画面へ進める。管理端末1はまだ説明を見ている
    frozen = true;
    const admin2 = await newDevice(browser, { signedIn: true });
    await admin2.page.goto(`/#/session/console/${sessionId}`);
    await openAdvanced(admin2.page);
    await admin2.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(admin2.page.getByTestId("now")).toContainText("抽選の準備中"); // 抽選画面の状態が届くまで待つ(届く前は「抽選画面を準備中」)
    const before = await admin2.page.getByTestId("now").innerText();
    await expect.poll(() => alerts.length, { timeout: 60_000 }).toBe(1); // 抽選画面を開いた時点の失敗の知らせ。以降は「次へ」のたびに増える
    await expect(admin.page.getByTestId("now")).toContainText("説明表示中"); // 古い表示のまま

    // 古い「次のスライドへ」を押す。ホストはもう抽選画面なので、そのまま抽選を進めてはいけない
    await nextButton(admin.page).click();
    await expect(admin2.page.getByTestId("log")).toContainText("jackpot.advance");
    await expect(admin2.page.getByText("未適用のコマンド")).toHaveCount(0); // ホストが処理(破棄)し終えた
    expect(await route(host.page)).toBe("/execute/jackpot-draw");
    await expect(admin2.page.getByTestId("now")).toHaveText(before);
    expect(alerts.length, "古い主ボタンで抽選をやり直していない").toBe(1);

    for (const d of [admin, host, admin2]) await d.context.close();
  });
});
