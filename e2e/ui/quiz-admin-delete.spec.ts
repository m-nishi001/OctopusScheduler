import { adminRpc, expect, newDevice, test } from "./fixtures";
import type { APIRequestContext, Page } from "@playwright/test";

/**
 * クイズ管理 > クイズ一覧: 画像付きのクイズを続けて消しても、ゾンビ(題名の空のクイズ)が出てこない。
 * 一覧が正で、画像は一覧から参照されるファイル。消すのは一覧から外すだけで、サーバーは一覧を書くときに外れたファイルを消す。
 */

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
/** 中身が1件ずつ違う画像(ハッシュが重ならないように末尾を変える)。 */
const uniquePng = (seed: string) => Buffer.concat([PNG_1X1, Buffer.from(seed)]);

type RecordEntry = { id: string; title: string; options: { image: string | null }[] };

async function serverRecord(request: APIRequestContext): Promise<RecordEntry[]> {
  const { json } = await adminRpc<{ json: string | null }>(request, "quizGame_getRecord", {});
  return json ? JSON.parse(json).data : [];
}

async function createQuizWithImage(page: Page, title: string, seed: string) {
  await page.getByRole("button", { name: "新規クイズ追加" }).click();
  const dialog = page.getByRole("dialog", { name: "クイズ追加" });
  await dialog.locator("input[type=text]").first().fill(title);
  await dialog.locator("textarea").fill("どれ?");
  await dialog.getByRole("button", { name: "選択肢を追加" }).click();
  const optionDialog = page.getByRole("dialog", { name: "選択肢追加" });
  await optionDialog.getByRole("textbox").first().fill("A");
  await optionDialog.locator("input[type=file]").setInputFiles({ name: `${seed}.png`, mimeType: "image/png", buffer: uniquePng(seed) });
  await optionDialog.getByRole("button", { name: "保存" }).click();
  await expect(optionDialog).toBeHidden();
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("クイズ管理の削除", () => {
  test("画像付きのクイズ3件を続けて消すと、同期のあと再読み込みしても戻らず、サーバーの画像も消える", async ({ browser, request }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    const run = Date.now();
    const titles = [1, 2, 3].map((n) => `e2e削除-${run}-${n}`);
    await page.goto("/#/quiz-admin");
    for (const [i, title] of titles.entries()) await createQuizWithImage(page, title, `${run}-${i}`);

    // サーバーに一覧と画像が届くまで待つ
    let hashes: string[] = [];
    await expect
      .poll(async () => {
        const mine = (await serverRecord(request)).filter((q) => titles.includes(q.title));
        hashes = mine.flatMap((q) => q.options.map((o) => o.image)).filter((h): h is string => !!h);
        return mine.length;
      }, { timeout: 60_000 })
      .toBe(3);
    expect(hashes).toHaveLength(3);
    const { existing } = await adminRpc<{ existing: string[] }>(request, "quizGame_existsBlobs", { hashes });
    expect(existing.sort()).toEqual([...hashes].sort());

    // 同期を待たずに続けて全部消す
    for (const title of titles) {
      const row = page.getByRole("row").filter({ hasText: title });
      await row.getByRole("button", { name: "削除" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "削除", exact: true }).click();
      await expect(row).toHaveCount(0);
    }

    // サーバーの一覧から消え、画像のファイルも消える
    await expect
      .poll(async () => (await serverRecord(request)).filter((q) => titles.includes(q.title)).length, { timeout: 60_000 })
      .toBe(0);
    await expect
      .poll(async () => (await adminRpc<{ existing: string[] }>(request, "quizGame_existsBlobs", { hashes })).existing.length, { timeout: 60_000 })
      .toBe(0);

    // 再読み込みしても、題名の空のクイズも含めて戻ってこない
    await page.reload();
    await expect(page.getByRole("button", { name: "新規クイズ追加" })).toBeVisible();
    for (const title of titles) await expect(page.getByRole("row").filter({ hasText: title })).toHaveCount(0);
    expect((await serverRecord(request)).filter((q) => !q.title)).toEqual([]);
    await d.context.close();
  });
});
