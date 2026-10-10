import type { Page } from "@playwright/test";
import { ADMIN_TOKEN, createSession, expect, joinPortal, newDevice, route, sampleQuiz, seedStore, test } from "./fixtures";

/**
 * クイズを、ホスト(投影)・管理・参加者(スマホ)の3端末で通しで動かす。
 * 問題の表示 → 参加者の回答(サーバ時刻の締切) → 締切 → 正解発表 → 結果、までを実ブラウザで確認する。
 */

async function addMembers(page: Page, names: string[]): Promise<void> {
  for (const [i, name] of names.entries()) {
    const res = await page.request.post("/rpc", {
      data: { name: "accounts_addMember", args: { __octopusAuth: ADMIN_TOKEN, args: { id: `qm${i + 1}`, name } } },
    });
    const json = await res.json();
    if (json.status !== "success" && !/already exists/.test(json.message ?? "")) throw new Error(json.message);
  }
}

const seedQuiz = (page: Page, id: string, timeLimit = 60) =>
  seedStore(page, "quiz-game", "QuizData", [{ id, value: sampleQuiz(id, timeLimit) }]);

test.describe("クイズの遠隔進行", () => {
  test("出題 → 参加者の回答 → 締切 → 正解発表 → 結果まで、管理端末の操作だけで進む", async ({ browser }) => {
    test.setTimeout(150_000);
    const adminDev = await newDevice(browser, { signedIn: true });
    await addMembers(adminDev.page, ["太郎", "花子"]);
    const { id, code } = await createSession(adminDev.page, "クイズ会場");
    await seedQuiz(adminDev.page, "qz1"); // 管理端末の一覧に出すため
    await adminDev.page.reload();

    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss());
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();
    await seedQuiz(host.page, "qz1");

    // 参加者(太郎)と、ゲスト(未選択)の2人
    const taro = await newDevice(browser, { mobile: true });
    await taro.page.goto(`/#/portal/${code}`);
    await taro.page.locator("#portal-member").selectOption({ label: "太郎" });
    await taro.page.getByRole("button", { name: "参加する" }).click();
    await expect(taro.page.locator(".portal__session")).toContainText("クイズ会場");
    const guest = await newDevice(browser, { mobile: true });
    await guest.page.goto(`/#/portal/${code}`);
    await guest.page.locator("#portal-name").fill("ゲスト花");
    await guest.page.getByRole("button", { name: "参加する" }).click();
    await expect(guest.page.locator(".portal__session")).toContainText("クイズ会場");

    // 管理端末: クイズを選んでイントロ → QR → 出題
    await adminDev.page.getByTestId("quiz-select").selectOption("qz1");
    await adminDev.page.getByTestId("quiz-panel").getByRole("button", { name: "イントロ" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/intro");
    await expect(adminDev.page.getByTestId("quiz-state")).toContainText("イントロ");
    await expect(taro.page.getByTestId("quiz-panel")).toContainText("クイズが始まります");

    await adminDev.page.getByTestId("quiz-panel").getByRole("button", { name: "次へ" }).click(); // Enter 相当 → QR
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/qr");
    await expect(host.page.locator(".qr-code")).toContainText(code); // ホストのQRは参加ポータル(参加コード入り)

    await adminDev.page.getByTestId("quiz-panel").getByRole("button", { name: "次へ" }).click(); // → 出題
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/play");
    await expect(adminDev.page.getByTestId("quiz-state")).toContainText("回答受付中");

    // 参加者のスマホに問題と選択肢が出て、残り時間が表示される
    await expect(taro.page.getByTestId("quiz-panel")).toContainText("みかんはどれ?");
    await expect(taro.page.getByTestId("quiz-timer")).toContainText("残り");
    await taro.page.getByRole("button", { name: /みかん/ }).click();
    await expect(taro.page.getByTestId("quiz-answered")).toContainText("2. みかん");
    await guest.page.getByRole("button", { name: /りんご/ }).click();
    await expect(guest.page.getByTestId("quiz-answered")).toContainText("1. りんご");
    // 回答後に選び直せない
    await expect(taro.page.getByRole("button", { name: /ぶどう/ })).toBeDisabled();
    // 管理端末に回答数(まとめて配信)
    await expect(adminDev.page.getByTestId("quiz-state")).toContainText("回答 2 人");

    // 参加者のリロードでも回答済み表示が残る
    await taro.page.reload();
    await expect(taro.page.getByTestId("quiz-answered")).toContainText("2. みかん");

    // 管理端末から受付を締め切る → 以後は回答できない
    await adminDev.page.getByRole("button", { name: "受付を今すぐ締め切る" }).click();
    await expect(host.page.getByText("受付終了。Enterで正解表示")).toBeVisible();
    await expect(guest.page.getByTestId("quiz-answered")).toBeVisible();

    // 正解発表: 参加者の画面に正解と正誤が出る
    await adminDev.page.getByTestId("quiz-panel").getByRole("button", { name: "次へ" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/answer");
    await expect(taro.page.getByTestId("quiz-correct")).toContainText("2. みかん");
    await expect(taro.page.getByTestId("quiz-verdict")).toHaveText("正解！");
    await expect(guest.page.getByTestId("quiz-verdict")).toContainText("残念");

    // 結果: ホストにランキング(正答者=太郎)が出る
    await adminDev.page.getByTestId("quiz-panel").getByRole("button", { name: "次へ" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/quiz/qz1/result");
    await expect(host.page.getByText("太郎").first()).toBeVisible({ timeout: 30_000 });
    await expect(taro.page.getByTestId("quiz-panel")).toContainText("結果発表中");

    for (const d of [adminDev, host, taro, guest]) await d.context.close();
  });

  test("制限時間が来ればホストが何もしなくても受付が終わり、締切後の回答は拒否される", async ({ browser }) => {
    test.setTimeout(120_000);
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id, code } = await createSession(adminDev.page, "締切会場");
    await seedQuiz(adminDev.page, "qz2", 4);
    await adminDev.page.reload();
    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss());
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();
    await seedQuiz(host.page, "qz2", 4);

    const phone = await newDevice(browser, { mobile: true });
    await joinPortal(phone.page, code);

    await adminDev.page.getByTestId("quiz-select").selectOption("qz2");
    await adminDev.page.getByTestId("quiz-panel").getByRole("button", { name: "出題" }).click();
    await expect(phone.page.getByTestId("quiz-panel")).toContainText("みかんはどれ?");
    // 4秒の制限時間が過ぎると、回答できなくなる(ボタンが無効 + 終了表示)
    await expect(phone.page.getByTestId("quiz-closed")).toBeVisible({ timeout: 20_000 });
    await expect(phone.page.getByRole("button", { name: /みかん/ })).toBeDisabled();
    await expect(host.page.getByText("受付終了。Enterで正解表示")).toBeVisible();

    for (const d of [adminDev, host, phone]) await d.context.close();
  });

  test("ホストのリロードでも出題が続き、回答済みの人の回答は消えない", async ({ browser }) => {
    test.setTimeout(120_000);
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id, code } = await createSession(adminDev.page, "再読込会場");
    await seedQuiz(adminDev.page, "qz3", 90);
    await adminDev.page.reload();
    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss());
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();
    await seedQuiz(host.page, "qz3", 90);
    const phone = await newDevice(browser, { mobile: true });
    await joinPortal(phone.page, code);

    await adminDev.page.getByTestId("quiz-select").selectOption("qz3");
    await adminDev.page.getByTestId("quiz-panel").getByRole("button", { name: "出題" }).click();
    await expect(phone.page.getByTestId("quiz-timer")).toBeVisible();
    await phone.page.getByRole("button", { name: /ぶどう/ }).click();
    await expect(phone.page.getByTestId("quiz-answered")).toContainText("3. ぶどう");

    await host.page.waitForTimeout(4000); // 時間を進めてからリロードする(やり直しなら残り時間が90に戻って判別できる)
    await host.page.reload(); // 出題中にホストがリロード
    await expect(adminDev.page.getByTestId("quiz-state")).toContainText("回答受付中");
    await expect(adminDev.page.getByTestId("quiz-state")).toContainText("回答 1 人"); // 回答は消えない
    // 残り時間は最初からやり直しではない(90秒のまま戻らない)
    const text = await phone.page.getByTestId("quiz-timer").innerText();
    expect(Number(text.match(/\d+/)![0])).toBeLessThan(89);

    for (const d of [adminDev, host, phone]) await d.context.close();
  });
});
