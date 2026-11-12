import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { Page } from "@playwright/test";
import { makeBadgePng, makeWav, TUNES } from "../../scripts/seed-content.js";
import { expect, newDevice, test } from "./fixtures";

/**
 * ジャックポット>画面設定の CSV/ZIP 取込・書き出し(全画面まとめて。ファイルに出てくる画面だけをまるごと置き換える)。
 * - 取り込むと、開いている画面の入力欄にも反映される(BGM・コンテンツ・SE)。素材は画面設定の索引に入る。
 * - 書き出した CSV / ZIP(media/)をそのまま取り込み直すと全行「変更なし」。
 * - 素材が無い・項目が違う行はエラーで、取り込めない。
 * 画像・音声はテストの中で生成する(公開リポジトリのため)。
 */

const stamp = Date.now();
const BGM = `scr-csv-${stamp}.wav`;
const SE = `scr-csv-se-${stamp}.wav`;
const PIC = `scr-csv-${stamp}.png`;
const tempDirs: string[] = [];

function mediaDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "screen-csv-e2e-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, BGM), makeWav(TUNES.draw));
  writeFileSync(join(dir, SE), makeWav(TUNES.prize));
  writeFileSync(join(dir, PIC), makeBadgePng("#10b981", "#064e3b", { width: 64, height: 64 }));
  return dir;
}

const HEADER = "画面,項目,素材,文字,種類,効果,秒数,効果音,コンテンツ名";
const ROWS = [
  `オープニング,BGM,${BGM},,,,,,`,
  `オープニング,コンテンツ,,ようこそ,テキスト,フェード,2,${SE},あいさつ`,
  `オープニング,コンテンツ,${PIC},,画像,静止,1.5,,ロゴ`,
  `デモ抽選,BGM,${BGM},,,,,,`,
  `デモ抽選,抽選SE,${SE},,,,,,`,
  `本抽選,メンバー抽選BGM,${BGM},,,,,,`,
  `本抽選,確変の回,,"3, 7",,,,,`,
  `本抽選,停止秒数,,6,,,,,`,
  `本抽選,参加者の停止,,不可,,,,,`,
  `最終結果,BGM,${SE},,,,,,`,
];
const csvOf = (...lines: string[]) => [HEADER, ...lines].join("\r\n") + "\r\n";
const table = (text: string, name = "screens.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf-8") });

async function pickCsv(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, media?: string) {
  await page.getByTestId("table-import-open").click();
  await page.getByTestId("table-import-table").setInputFiles(file);
  if (media) await page.getByTestId("table-import-media").setInputFiles(media);
}

test.afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

test.describe("ジャックポット画面設定の CSV 取込・書き出し", () => {
  test("取込 -> 画面に反映 -> 書き出し -> 取り込み直しは全行変更なし -> エラー行は取り込めない", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    await page.goto("/#/execute/jackpot-admin/screens/opening");
    await expect(page.getByTestId("table-export")).toBeVisible();

    // 取込(素材フォルダつき): 3種類の素材が入る
    await pickCsv(page, table(csvOf(...ROWS)), mediaDir());
    await expect(page.locator('[data-testid="table-import-row"]')).toHaveCount(ROWS.length);
    await expect(page.locator('[data-testid="table-import-row"][data-status="error"]')).toHaveCount(0);
    await expect(page.getByTestId("table-import-media-counts")).toContainText("追加 3");
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("table-import-close").click();

    // 開いているオープニングの入力欄に反映される
    await expect(page.getByTestId("media-name").first()).toHaveText(BGM);
    await expect(page.getByText("あいさつ", { exact: true })).toBeVisible();
    await expect(page.getByText("ロゴ", { exact: true })).toBeVisible();
    // デモ抽選・最終結果にも入っている
    await page.getByRole("link", { name: "デモ抽選" }).click();
    await expect(page.getByTestId("media-name").nth(0)).toHaveText(BGM);
    await expect(page.getByTestId("media-name").nth(1)).toHaveText(SE);
    await page.getByRole("link", { name: "最終結果" }).click();
    await expect(page.getByTestId("media-name").first()).toHaveText(SE);
    // 本抽選: 確変の回
    await page.getByRole("link", { name: "本抽選" }).click();
    await expect(page.getByTestId("kakuhen-mode")).toHaveValue("fixed");
    await expect(page.getByTestId("kakuhen-timings")).toHaveValue("3, 7");
    await expect(page.getByTestId("participant-stop-checkbox")).not.toBeChecked();

    // 書き出し(CSV): 取込と同じ書式
    const csvDownload = page.waitForEvent("download");
    await page.getByTestId("table-export").click();
    const csvFile = await csvDownload;
    expect(csvFile.suggestedFilename()).toBe("screens.csv");
    const csvText = readFileSync(await csvFile.path(), "utf-8");
    expect(csvText.startsWith(`﻿${HEADER}\r\n`)).toBe(true);
    expect(csvText).toContain(`オープニング,BGM,${BGM},,,,,,\r\n`);
    expect(csvText).toContain(`オープニング,コンテンツ,,ようこそ,テキスト,フェード,2,${SE},あいさつ\r\n`);
    expect(csvText).toContain("本抽選,確変の回,,\"3, 7\",,,,,\r\n");
    expect(csvText).toContain("本抽選,参加者の停止,,不可,,,,,\r\n");

    // 書き出し(ZIP): 参照されている素材が media/ に入る
    await page.getByTestId("table-export-media").check();
    const zipDownload = page.waitForEvent("download");
    await page.getByTestId("table-export").click();
    const zipFile = await zipDownload;
    expect(zipFile.suggestedFilename()).toBe("screens.zip");
    const zipBytes = readFileSync(await zipFile.path());
    const names = Object.keys(unzipSync(new Uint8Array(zipBytes)));
    for (const n of [BGM, SE, PIC]) expect(names).toContain(`media/${n}`);

    // そのまま取り込み直すと、ZIP も CSV も全行「変更なし」
    for (const file of [{ name: "screens.zip", mimeType: "application/zip", buffer: zipBytes }, table(csvText)]) {
      await pickCsv(page, file);
      await expect(page.getByTestId("table-import-counts")).toContainText(/追加 0 \/ 更新 0 \/ 変更なし \d+ \/ エラー 0/);
      await expect(page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
      await page.getByRole("button", { name: "閉じる" }).click();
    }

    // エラーの行: 素材が無い / 画面が違う / その画面で使えない項目 / 音の欄に画像
    await pickCsv(page, table(csvOf(`最終結果,BGM,nothing-${stamp}.wav,,,,,,`, "ホーム,BGM,,,,,,,", "オープニング,抽選SE,,,,,,,", `デモ抽選,BGM,${PIC},,,,,,`)), mediaDir());
    await expect(page.getByTestId("table-import-counts")).toContainText("エラー 4");
    const errors = page.locator('[data-testid="table-import-row"][data-status="error"]');
    await expect(errors.nth(0)).toContainText(`「nothing-${stamp}.wav」が見つかりません`);
    await expect(errors.nth(1)).toContainText("画面は");
    await expect(errors.nth(2)).toContainText("「オープニング」の項目は");
    await expect(errors.nth(3)).toContainText("音ではありません");
    await expect(page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
    await page.getByRole("button", { name: "閉じる" }).click();

    // 後始末: 取り込んだ画面を空の設定に戻す(ファイルに出てくる画面を置き換える)
    await pickCsv(page, table(csvOf("オープニング,BGM,,,,,,,", "デモ抽選,BGM,,,,,,,", "本抽選,確変の回,,おまかせ,,,,,", "最終結果,BGM,,,,,,,")));
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("table-import-close").click();
    await d.context.close();
  });
});
