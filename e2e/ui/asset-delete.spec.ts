import { adminRpc, expect, newDevice, test } from "./fixtures";
import type { APIRequestContext } from "@playwright/test";

/**
 * アプリのアセットの削除: 一覧が正で、削除は一覧から外すだけ。同期のあと再読み込みしても戻らず、
 * サーバーの一覧からもファイルからも消える。
 */

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
/** 中身が1件ずつ違う画像(ハッシュが重ならないように末尾を変える)。 */
const uniquePng = (seed: string) => Buffer.concat([PNG_1X1, Buffer.from(seed)]);

type Entry = { id: string; name: string; hash: string };

async function serverEntries(request: APIRequestContext, endpoint: string): Promise<Entry[]> {
  const { json } = await adminRpc<{ json: string | null }>(request, endpoint, {});
  return json ? JSON.parse(json).data : [];
}

const blobsExisting = async (request: APIRequestContext, endpoint: string, hashes: string[]) =>
  (await adminRpc<{ existing: string[] }>(request, endpoint, { hashes })).existing;

test.describe("アセットの削除", () => {
  test("アプリのアセット: 削除 → 同期 → 再読み込みしても戻らず、サーバーのファイルも消える", async ({ browser, request }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    const name = `e2e-app-asset-${Date.now()}.png`;
    await page.goto("/#/settings?tab=assets");
    await page.getByRole("button", { name: "追加", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "アセットを追加" });
    await dialog.locator("input[type=file]").setInputFiles({ name, mimeType: "image/png", buffer: uniquePng(name) });
    await dialog.getByRole("button", { name: "追加", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();

    let entry: Entry | undefined;
    await expect
      .poll(async () => (entry = (await serverEntries(request, "octopusScheduler_getAssetRecord")).find((e) => e.name === name)) !== undefined, { timeout: 60_000 })
      .toBe(true);
    expect(await blobsExisting(request, "octopusScheduler_existsAssetBlobs", [entry!.hash])).toEqual([entry!.hash]);

    await row.getByRole("button", { name: "削除" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "削除", exact: true }).click();
    await expect(row).toHaveCount(0);

    await expect
      .poll(async () => (await serverEntries(request, "octopusScheduler_getAssetRecord")).some((e) => e.name === name), { timeout: 60_000 })
      .toBe(false);
    await expect
      .poll(async () => (await blobsExisting(request, "octopusScheduler_existsAssetBlobs", [entry!.hash])).length, { timeout: 60_000 })
      .toBe(0);

    await page.reload();
    await expect(page.getByRole("button", { name: "追加", exact: true })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
    await d.context.close();
  });
});
