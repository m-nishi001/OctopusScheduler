import { adminRpc, expect, isGas, newDevice, test } from "./fixtures";
import type { Device } from "./fixtures";

/**
 * 画面設定の同期(バックグラウンド同期)の動きと、ヘッダーの「同期の状態」から開く詳細。
 * 停止秒(景品抽選が止まるまでの時間)を使って、画面設定を別の端末と受け渡す。
 */
const DRAW_PAGE = "/#/execute/jackpot-admin/screens/draw";
const SCREENS_FILE = "screens.json";

/** サーバーに保存されている画面設定の中の停止秒(未設定なら null)。 */
async function serverStopSec(device: Device): Promise<number | null> {
  const res = await adminRpc<{ json: string | null }>(device.page.request, "jackpotGame_getJson", SCREENS_FILE);
  const match = res.json?.match(/prizeStopSec[^0-9]*(\d+)/);
  return match ? Number(match[1]) : null;
}

async function saveStopSec(device: Device, sec: number): Promise<void> {
  await device.page.getByTestId("prize-stop-sec").fill(String(sec));
  await device.page.getByRole("button", { name: "保存" }).click();
  await expect(device.page.getByText("保存しました")).toBeVisible();
}

test.describe("画面設定の同期と、同期の詳細", () => {
  test("他の端末が変えた画面設定を取り込むと、フォームが新しい値に変わり、詳細に「他の端末の変更を反映」が残る", async ({ browser }) => {
    test.setTimeout(120_000);
    const a = await newDevice(browser, { signedIn: true });
    const b = await newDevice(browser, { signedIn: true });
    try {
      // 定期の同期(60秒おき)を待たずに進められるよう、時計を操作できるようにしておく
      await a.page.clock.install();
      await a.page.goto(DRAW_PAGE);
      const secA = a.page.getByTestId("prize-stop-sec");
      await expect(secA).toBeVisible();
      const original = Number(await secA.inputValue());
      const changed = original === 9 ? 8 : 9;

      // 別の端末(B)が停止秒を変える。サーバーに届くまで待つ
      await b.page.goto(DRAW_PAGE);
      await expect(b.page.getByTestId("prize-stop-sec")).toBeVisible();
      await saveStopSec(b, changed);
      await expect.poll(() => serverStopSec(b), { timeout: 20_000 }).toBe(changed);

      // A は定期の同期で取り込み、開いているフォームが新しい値に変わる(開き直さない)
      await a.page.clock.fastForward(61_000);
      await expect(secA).toHaveValue(String(changed));

      // 詳細を開くと、画面設定の変更を反映した行がある
      await a.page.getByTestId("sync-status").click();
      const row = a.page.getByTestId("sync-log").getByRole("row").filter({ hasText: "画面設定" }).filter({ hasText: "他の端末の変更を反映" });
      await expect(row.first()).toBeVisible();
      await a.page.keyboard.press("Escape");

      // ほかのテストに影響させないよう、元の値に戻す
      await saveStopSec(b, original);
      await expect.poll(() => serverStopSec(b), { timeout: 20_000 }).toBe(original);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test("送信の最中に次の値を保存しても、その値が失われず、最後にサーバーへ届く", async ({ browser }) => {
    test.setTimeout(120_000);
    const a = await newDevice(browser, { signedIn: true });
    const checker = await newDevice(browser, { signedIn: true });
    try {
      await a.page.goto(DRAW_PAGE);
      const sec = a.page.getByTestId("prize-stop-sec");
      await expect(sec).toBeVisible();
      const original = Number(await sec.inputValue());
      const first = original === 15 ? 14 : 15;

      // 1回目の値(first)の送信を止めて、送信の最中を作る
      let sending = false;
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      await a.page.route("**/rpc", async (route) => {
        const body = route.request().postData() ?? "";
        if (!sending && body.includes("jackpotGame_addJson") && new RegExp(`prizeStopSec[^0-9]*${first}\\b`).test(body)) {
          sending = true;
          await gate;
        }
        await route.continue();
      });

      await saveStopSec(a, first);
      await expect.poll(() => sending, { timeout: 20_000 }).toBe(true);
      await saveStopSec(a, original); // 送信の最中に、元の値へ戻す
      release();

      // 送信が終わっても、あとの保存(original)は消えず、サーバーにも届く
      await expect.poll(() => serverStopSec(checker), { timeout: 30_000 }).toBe(original);
      await a.page.reload();
      await expect(a.page.getByTestId("prize-stop-sec")).toHaveValue(String(original));
    } finally {
      await a.context.close();
      await checker.context.close();
    }
  });

  test("サーバーへの送信に失敗すると「同期エラー」になり、押すと対象と理由(ステータスとメッセージ)が出る", async ({ browser }) => {
    test.skip(isGas, "HTTP のステータスは Cloudflare の API クライアントだけが付ける");
    test.setTimeout(120_000);
    const a = await newDevice(browser, { signedIn: true });
    const checker = await newDevice(browser, { signedIn: true });
    try {
      await a.page.goto(DRAW_PAGE);
      const sec = a.page.getByTestId("prize-stop-sec");
      await expect(sec).toBeVisible();
      const original = Number(await sec.inputValue());

      // 保存はサーバーへの送信(addJson)が 500 で断られる
      const failing = async (route: import("@playwright/test").Route) => {
        const body = route.request().postData() ?? "";
        if (body.includes("jackpotGame_addJson")) {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ status: "error", message: "サーバー内部のエラー", retryable: false }) });
          return;
        }
        await route.continue();
      };
      await a.page.route("**/rpc", failing);

      await saveStopSec(a, original === 6 ? 5 : 6);
      const indicator = a.page.getByTestId("sync-status");
      await expect(indicator).toContainText("同期エラー", { timeout: 20_000 });

      await indicator.click();
      const row = a.page.getByTestId("sync-log").getByRole("row").filter({ hasText: "画面設定" }).filter({ hasText: "送信に失敗" });
      await expect(row.first()).toBeVisible();
      await expect(row.first()).toContainText("HTTP 500");
      await expect(row.first()).toContainText("サーバー内部のエラー");
      await a.page.keyboard.press("Escape");

      // 通信が戻れば、次の同期でもう一度送られ、「同期済み」に戻る。元の値に戻しておく
      await a.page.unroute("**/rpc", failing);
      await saveStopSec(a, original);
      await expect(indicator).toContainText("同期済み", { timeout: 30_000 });
      await expect.poll(() => serverStopSec(checker), { timeout: 20_000 }).toBe(original);
    } finally {
      await a.context.close();
      await checker.context.close();
    }
  });
});
