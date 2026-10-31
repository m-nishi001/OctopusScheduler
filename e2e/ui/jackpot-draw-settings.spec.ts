import { expect, newDevice, test } from "./fixtures";

/**
 * 本抽選画面設定の「確変の起こし方」と、メンバーの「当選しやすさ」が、管理画面から設定でき、保存されること。
 * 設定が実際の抽選に効くことは、単体テスト（draw-full-run.spec.ts / member-draw-service.spec.ts）で確かめている。
 */
test.describe("ジャックポットの管理画面の設定", () => {
  test("確変の起こし方を「回を指定する」にして保存でき、開き直しても残る。「おまかせ」に戻すと回の入力欄は隠れる", async ({ browser }) => {
    const dev = await newDevice(browser, { signedIn: true });
    const page = dev.page;
    await page.goto("/#/execute/jackpot-admin/screens/draw");

    const mode = page.getByTestId("kakuhen-mode");
    await expect(mode).toBeVisible();
    await expect(mode).toHaveValue("auto");
    await expect(page.getByTestId("kakuhen-timings")).toBeHidden();

    await mode.selectOption("fixed");
    await page.getByTestId("kakuhen-timings").fill("7, 3, 3");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
    // 保存すると、重複を除いて小さい順に整えた表示に戻る
    await expect(page.getByTestId("kakuhen-timings")).toHaveValue("3, 7");

    await page.reload();
    await expect(page.getByTestId("kakuhen-mode")).toHaveValue("fixed");
    await expect(page.getByTestId("kakuhen-timings")).toHaveValue("3, 7");

    await page.getByTestId("kakuhen-mode").selectOption("auto");
    await expect(page.getByTestId("kakuhen-timings")).toBeHidden();
    await dev.context.close();
  });

  test("景品抽選が止まるまでの時間(初期値4秒)を変えて保存でき、開き直しても残る。範囲外は収められる", async ({ browser }) => {
    const dev = await newDevice(browser, { signedIn: true });
    const page = dev.page;
    await page.goto("/#/execute/jackpot-admin/screens/draw");

    const sec = page.getByTestId("prize-stop-sec");
    await expect(sec).toBeVisible();
    await expect(sec, "初期値").toHaveValue("4");
    await expect(page.getByText("停止ボタンを押してから、最後の景品が止まるまでの長さ")).toBeVisible();

    await sec.fill("7");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("prize-stop-sec")).toHaveValue("7");

    // 画面設定はバックグラウンド同期(2秒のデバウンス)でサーバーへ送られ、別の端末(本抽選画面)はそれを取り込む。
    // 送信の最中に次の保存をすると、あとの保存が同期で失われてサーバーの値に戻ってしまうことがある。
    // そのため、1回ごとに送信の完了を待ってから次へ進み、最後に必ず「4秒に戻した」内容をサーバーに届ける
    // (15秒が残ると、あとのテスト(止まり方など)の停止が15秒かかってしまう)。
    const pushedWith = (sec: number) =>
      page.waitForResponse((r) => new RegExp(`prizeStopSec[^0-9]*${sec}\\b`).test(r.request().postData() ?? ""), { timeout: 20_000 });

    // 範囲(2〜15秒)に収めて保存される
    const pushed15 = pushedWith(15);
    await page.getByTestId("prize-stop-sec").fill("99");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
    await expect(page.getByTestId("prize-stop-sec")).toHaveValue("15");
    await pushed15;

    // 初期値に戻しておく(ほかのテストに影響させない)
    const pushed4 = pushedWith(4);
    await page.getByTestId("prize-stop-sec").fill("4");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
    await pushed4;
    await page.reload();
    await expect(page.getByTestId("prize-stop-sec")).toHaveValue("4");
    await dev.context.close();
  });
});
