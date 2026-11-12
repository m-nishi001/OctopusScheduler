import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { APIRequestContext, Page } from "@playwright/test";
import { makeBadgePng, makeWav, TUNES } from "../../scripts/seed-content.js";
import { adminRpc, expect, newDevice, test } from "./fixtures";

/**
 * 設定>アセットの CSV 取込・書き出し(フォルダつき)。
 * - `名前,フォルダ` の CSV と素材のフォルダから、素材をフォルダ別に取り込む。一覧に「フォルダ」の列が出る。
 * - 書き出した CSV / ZIP(media/<名前>)をそのまま取り込み直すと全行「変更なし」。
 * - ファイルが無い既存の素材は、フォルダだけ変えられる。同じ名前で中身が違うファイルは差し替え。
 * - ファイルが無い新しい名前などの行はエラーで、取り込めない。
 * 置き換え(ファイルに無い素材を消す)は、共有のサーバーの素材まで消えるので、単体テストで確かめる。
 * 画像・音声はテストの中で生成する(公開リポジトリのため)。
 */

const stamp = Date.now();
const BGM = `asset-csv-${stamp}.wav`;
const PIC = `asset-csv-${stamp}.png`;
const FOLDER = `f${stamp}`;
const tempDirs: string[] = [];

function mediaDir(tune: Parameters<typeof makeWav>[0]): string {
  const dir = mkdtempSync(join(tmpdir(), "asset-csv-e2e-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, BGM), makeWav(tune));
  writeFileSync(join(dir, PIC), makeBadgePng("#10b981", "#064e3b", { width: 64, height: 64 }));
  return dir;
}

const csvOf = (...lines: string[]) => ["名前,フォルダ", ...lines].join("\r\n") + "\r\n";
const table = (text: string, name = "assets.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf-8") });

type Entry = { id: string; name: string; hash: string; directoryId?: string };
const serverAssets = async (request: APIRequestContext): Promise<Entry[]> => {
  const { json } = await adminRpc<{ json: string | null }>(request, "octopusScheduler_getAssetRecord", {});
  return json ? JSON.parse(json).data : [];
};
const mine = (entries: Entry[]) => entries.filter((e) => e.name === BGM || e.name === PIC);

async function openAssets(page: Page) {
  await page.goto("/#/settings?tab=assets");
  await expect(page.getByRole("button", { name: "追加", exact: true })).toBeVisible();
}

async function pickCsv(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, media?: string) {
  await page.getByTestId("table-import-open").click();
  await page.getByTestId("table-import-table").setInputFiles(file);
  if (media) await page.getByTestId("table-import-media").setInputFiles(media);
}

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

test.describe("アセットの CSV 取込・書き出し", () => {
  test("取込(フォルダつき)→ 書き出し → 取り込み直しは変更なし → フォルダだけ変更 → 差し替え → エラー行", async ({ browser, request }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    await openAssets(page);

    // 取込: BGM はフォルダつき、画像は置き場直下
    await pickCsv(page, table(csvOf(`${BGM},${FOLDER}`, `${PIC},`)), mediaDir(TUNES.draw));
    await expect(page.getByTestId("table-import-counts")).toContainText("追加 2 / 更新 0 / 変更なし 0 / 削除 0 / エラー 0");
    await expect(page.getByTestId("table-import-media-counts")).toContainText("追加 2");
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toContainText("追加 2", { timeout: 60_000 });
    await page.getByTestId("table-import-close").click();
    await expect(page.getByRole("row").filter({ hasText: BGM })).toContainText(FOLDER);
    await expect.poll(async () => mine(await serverAssets(request)).length, { timeout: 60_000 }).toBe(2);
    const before = mine(await serverAssets(request));
    expect(before.find((e) => e.name === BGM)!.directoryId).toBe(`octopus-scheduler/assets/${FOLDER}`);
    expect(before.find((e) => e.name === PIC)!.directoryId).toBeFalsy();

    // 書き出し(CSV)
    const csvDownload = page.waitForEvent("download");
    await page.getByTestId("table-export").click();
    const csvFile = await csvDownload;
    expect(csvFile.suggestedFilename()).toBe("assets.csv");
    const csvText = readFileSync(await csvFile.path(), "utf-8");
    expect(csvText.startsWith("﻿名前,フォルダ\r\n")).toBe(true);
    expect(csvText).toContain(`${BGM},${FOLDER}\r\n`);
    expect(csvText).toContain(`${PIC},\r\n`);

    // 書き出し(ZIP): 全素材が media/<名前>
    await page.getByTestId("table-export-media").check();
    const zipDownload = page.waitForEvent("download");
    await page.getByTestId("table-export").click();
    const zipFile = await zipDownload;
    expect(zipFile.suggestedFilename()).toBe("assets.zip");
    const zipBytes = readFileSync(await zipFile.path());
    const entries = Object.keys(unzipSync(new Uint8Array(zipBytes)));
    expect(entries).toContain(`media/${BGM}`);
    expect(entries).toContain(`media/${PIC}`);

    // そのまま取り込み直すと、CSV も ZIP も全行「変更なし」
    for (const file of [{ name: "assets.zip", mimeType: "application/zip", buffer: zipBytes }, table(csvText)]) {
      await pickCsv(page, file);
      await expect(page.getByTestId("table-import-counts")).toContainText(/追加 0 \/ 更新 0 \/ 変更なし \d+ \/ 削除 0 \/ エラー 0/);
      await expect(page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
      await page.getByRole("button", { name: "閉じる" }).click();
    }

    // ファイルが無くても、既存の素材はフォルダだけ変えられる(中身はそのまま)
    await pickCsv(page, table(csvOf(`${BGM},`, `${PIC},${FOLDER}`)));
    await expect(page.getByTestId("table-import-counts")).toContainText("追加 0 / 更新 2 / 変更なし 0 / 削除 0 / エラー 0");
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toContainText("更新 2", { timeout: 60_000 });
    await page.getByTestId("table-import-close").click();
    await expect
      .poll(async () => mine(await serverAssets(request)).find((e) => e.name === PIC)?.directoryId, { timeout: 60_000 })
      .toBe(`octopus-scheduler/assets/${FOLDER}`);
    const moved = mine(await serverAssets(request));
    expect(moved.find((e) => e.name === BGM)!.directoryId).toBeFalsy();
    expect(moved.find((e) => e.name === BGM)!.hash).toBe(before.find((e) => e.name === BGM)!.hash);

    // 同じ名前で中身が違う BGM は、同じ素材(同じ id)の差し替え
    await pickCsv(page, table(csvOf(`${BGM},`)), mediaDir(TUNES.prize));
    await expect(page.getByTestId("table-import-media-counts")).toContainText("差し替え 1");
    await expect(page.getByTestId("table-import-counts")).toContainText("追加 0 / 更新 1");
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toContainText("更新 1", { timeout: 60_000 });
    await page.getByTestId("table-import-close").click();
    await expect
      .poll(async () => mine(await serverAssets(request)).find((e) => e.name === BGM)?.hash, { timeout: 60_000 })
      .not.toBe(before.find((e) => e.name === BGM)!.hash);
    expect(mine(await serverAssets(request)).find((e) => e.name === BGM)!.id).toBe(before.find((e) => e.name === BGM)!.id);

    // エラーの行: ファイルが無い新しい名前 / 2階層のフォルダ / 名前にフォルダ
    await pickCsv(page, table(csvOf(`nothing-${stamp}.png,`, `${PIC},a/b`, `x/${PIC},`, `${BGM},ok`)));
    await expect(page.getByTestId("table-import-counts")).toContainText("エラー 3");
    const errors = page.locator('[data-testid="table-import-row"][data-status="error"]');
    await expect(errors.nth(0)).toContainText(`「nothing-${stamp}.png」が見つかりません`);
    await expect(errors.nth(1)).toContainText("1階層");
    await expect(errors.nth(2)).toContainText("フォルダは含められません");
    await expect(page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
    await page.getByRole("button", { name: "閉じる" }).click();

    // 後始末
    for (const name of [BGM, PIC]) {
      await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "削除" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "削除", exact: true }).click();
      await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
    }
    await expect.poll(async () => mine(await serverAssets(request)).length, { timeout: 60_000 }).toBe(0);
    await d.context.close();
  });
});
