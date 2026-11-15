import { readFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Page } from "@playwright/test";
import { makeBadgePng, makeWav, TUNES } from "../../scripts/seed-content.js";
import { expect, newDevice, seedJackpot, test } from "./fixtures";

/**
 * ジャックポット>画面設定の screens.zip(screens.csv + pages.csv + media/)の取込・書き出し(全画面まとめて。ファイルに出てくる画面だけをまるごと置き換える)。
 * - 取り込むと、設定と、開いている画面の入力欄にも反映される(BGM・ページ・SE・デモ抽選・確変の決め方)。素材は画面設定の索引に入る。
 * - 書き出した ZIP / CSV をそのまま取り込み直すと全行「変更なし」。
 * - 素材が無い・使わない列・決まった語でない値・説明に効果などを入れた行はエラーで、取り込めない。旧形式(縦長)は断る。
 * 画像・音声はテストの中で生成する(公開リポジトリのため)。
 */

const stamp = Date.now();
const BGM = `scr-csv-${stamp}.wav`;
const SE = `scr-csv-se-${stamp}.wav`;
const PIC = `scr-csv-${stamp}.png`;
const SCREENS_HEADER = "画面,BGM,メンバー抽選BGM,景品抽選BGM,デモ抽選,デモ回数,メンバー停止秒,景品停止秒,参加者の停止,確変の決め方,確変の回";
const PAGES_HEADER = "画面,種類,文字,画像,効果,秒数,行数,効果音,名前";
const SCREEN_ROWS = [
  `オープニング,${BGM},,,,,,,,,`,
  `説明,,,,,,,,,,`,
  `デモ抽選,${BGM},,,なし,2,,,,,`,
  `本抽選,,${BGM};${SE},${SE},,,5,6,不可,回を指定,"3, 7"`,
  `最終結果,${SE},,,,,,,,,`,
];
const PAGE_ROWS = [
  `オープニング,テキスト,ようこそ,,フェード,2,,${SE},あいさつ`,
  `オープニング,画像,,${PIC},静止,1.5,,,ロゴ`,
  `オープニング,テキスト,"一行目\n二行目\n三行目",,行送り,2,2,,送り`,
  `説明,テキスト,ルール,,,,,,`,
  `説明,画像,,${PIC},,,,,`,
];
const csvOf = (header: string, ...lines: string[]) => [header, ...lines].join("\r\n") + "\r\n";
const screensCsv = (...lines: string[]) => csvOf(SCREENS_HEADER, ...lines);
const pagesCsv = (...lines: string[]) => csvOf(PAGES_HEADER, ...lines);
const table = (text: string, name = "screens.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf-8") });

/** screens.csv・pages.csv・素材(media/)を入れた screens.zip(GAS が作る screens.zip と同じ形)。 */
function buildScreensZip(screens: string, pages: string): { name: string; mimeType: string; buffer: Buffer } {
  const bytes = zipSync({
    "screens.csv": strToU8(screens),
    "pages.csv": strToU8(pages),
    [`media/${BGM}`]: makeWav(TUNES.draw),
    [`media/${SE}`]: makeWav(TUNES.prize),
    [`media/${PIC}`]: makeBadgePng("#10b981", "#064e3b", { width: 64, height: 64 }),
  });
  return { name: "screens.zip", mimeType: "application/zip", buffer: Buffer.from(bytes) };
}

async function pick(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, media?: string) {
  await page.getByTestId("table-import-open").click();
  await page.getByTestId("table-import-table").setInputFiles(file);
  if (media) await page.getByTestId("table-import-media").setInputFiles(media);
}

test.describe("ジャックポット画面設定の screens.zip(screens.csv + pages.csv)の取込・書き出し", () => {
  test("screens.zip を取り込む -> 設定と表示に反映 -> 書き出し -> 取り込み直しは全行変更なし -> エラー行は取り込めない -> 旧形式は断る", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    // 空の設定から始める(ほかのテストが同期したサーバーの設定を読まないように)
    await page.goto("/#/sessions");
    await seedJackpot(page, { demoDraw: true });
    await page.goto("/#/execute/jackpot-admin/screens/opening");
    await page.reload();
    await expect(page.getByTestId("table-export")).toBeVisible();

    // 取込(素材入りの ZIP): 3種類の素材が入る
    const zipFile = buildScreensZip(screensCsv(...SCREEN_ROWS), pagesCsv(...PAGE_ROWS));
    await pick(page, zipFile);
    await expect(page.locator('[data-testid="table-import-row"]')).toHaveCount(SCREEN_ROWS.length + PAGE_ROWS.length);
    await expect(page.locator('[data-testid="table-import-row"][data-status="error"]')).toHaveCount(0);
    await expect(page.getByTestId("table-import-media-counts")).toContainText("追加 3");
    // 回の数(2)が確変対応ありの景品の数(0)と違うので、本抽選の行に注意が出る(取り込める)
    await expect(page.locator('[data-testid="table-import-row"]', { hasText: "screens.csv 本抽選" })).toContainText("注意: 確変にする回（2回）が、確変対応ありの景品（0件）より多い");
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("table-import-close").click();

    // 開いているオープニングの入力欄に反映される(BGM・ページ)
    await expect(page.getByTestId("media-name").first()).toHaveText(BGM);
    await expect(page.getByText("あいさつ [フェード 2秒]", { exact: true })).toBeVisible();
    await expect(page.getByText("ロゴ [静止 1.5秒]", { exact: true })).toBeVisible();
    await expect(page.getByText("送り [行送り 2秒]", { exact: true })).toBeVisible();
    // 説明: 画像かテキストのページ
    await page.getByRole("link", { name: "説明", exact: true }).click();
    await expect(page.getByTestId("entry-row")).toHaveCount(2);
    await expect(page.getByTestId("entry-row").first()).toContainText("ルール");
    // デモ抽選・最終結果
    await page.getByRole("link", { name: "デモ抽選" }).click();
    await expect(page.getByTestId("media-name").first()).toHaveText(BGM);
    await expect(page.getByTestId("demo-enabled")).not.toBeChecked();
    await expect(page.getByTestId("demo-rounds")).toHaveValue("2");
    await page.getByRole("link", { name: "最終結果" }).click();
    await expect(page.getByTestId("media-name").first()).toHaveText(SE);
    // 本抽選: 確変の決め方・確変の回・停止秒数・参加者の停止
    await page.getByRole("link", { name: "本抽選" }).click();
    await expect(page.getByTestId("kakuhen-mode")).toHaveValue("fixed");
    await expect(page.getByTestId("kakuhen-timings")).toHaveValue("3, 7");
    await expect(page.getByTestId("member-stop-sec")).toHaveValue("5");
    await expect(page.getByTestId("prize-stop-sec")).toHaveValue("6");
    await expect(page.getByTestId("participant-stop-checkbox")).not.toBeChecked();

    // 書き出し: screens.zip に screens.csv と pages.csv と media/
    await page.getByTestId("table-export-media").check();
    const zipDownload = page.waitForEvent("download");
    await page.getByTestId("table-export").click();
    const exported = await zipDownload;
    expect(exported.suggestedFilename()).toBe("screens.zip");
    const exportedBytes = readFileSync(await exported.path());
    const files = unzipSync(new Uint8Array(exportedBytes));
    expect(Object.keys(files).sort()).toEqual(["media/" + BGM, "media/" + PIC, "media/" + SE, "pages.csv", "screens.csv"].sort());
    const exportedScreens = strFromU8(files["screens.csv"]);
    const exportedPages = strFromU8(files["pages.csv"]);
    expect(exportedScreens.startsWith(`${SCREENS_HEADER}\r\n`)).toBe(true);
    expect(exportedPages.startsWith(`${PAGES_HEADER}\r\n`)).toBe(true);
    expect(exportedScreens).toContain(`本抽選,,${BGM};${SE},${SE},,,5,6,不可,回を指定,"3, 7"\r\n`);
    expect(exportedScreens).toContain("デモ抽選,");
    expect(exportedPages).toContain(`オープニング,テキスト,ようこそ,,フェード,2,,${SE},あいさつ\r\n`);

    // そのまま取り込み直すと、ZIP も CSV(1つずつ)も全行「変更なし」
    for (const file of [{ name: "screens.zip", mimeType: "application/zip", buffer: exportedBytes }, table(exportedScreens), table(exportedPages, "pages.csv")]) {
      await pick(page, file);
      await expect(page.getByTestId("table-import-counts")).toContainText(/追加 0 \/ 更新 0 \/ 変更なし \d+ \/ エラー 0/);
      await expect(page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
      await page.getByRole("button", { name: "閉じる" }).click();
    }

    // エラーの行: 素材が無い / 画面が違う / 使わない列 / TRUE を使った / 説明に効果
    const bad = buildScreensZip(
      screensCsv(`最終結果,nothing-${stamp}.wav,,,,,,,,,`, "ホーム,,,,,,,,,,", "オープニング,,,,,2,,,,,", "デモ抽選,,,,TRUE,,,,,,", "本抽選,,,,,,,,不可,回を指定,"),
      pagesCsv("説明,テキスト,x,,静止,,,,", `オープニング,画像,,${PIC},行送り,,,,`)
    );
    await pick(page, bad);
    await expect(page.getByTestId("table-import-counts")).toContainText("エラー 7");
    const errors = page.locator('[data-testid="table-import-row"][data-status="error"]');
    await expect(errors.nth(0)).toContainText(`「nothing-${stamp}.wav」が見つかりません`);
    await expect(errors.nth(1)).toContainText("画面は");
    await expect(errors.nth(2)).toContainText("「オープニング」では「デモ回数」は使いません");
    await expect(errors.nth(3)).toContainText("あり・なし");
    await expect(errors.nth(4)).toContainText("確変の回を");
    await expect(errors.nth(5)).toContainText("効果・秒数・行数・効果音は入れられません");
    await expect(errors.nth(6)).toContainText("行送りはテキストだけ");
    await expect(page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
    await page.getByRole("button", { name: "閉じる" }).click();

    // 旧形式(縦長の 画面/項目/素材…)は、使えなくなったことを伝えて取り込まない
    await pick(page, table("画面,項目,素材,文字,種類,効果,秒数,行数,効果音,コンテンツ名\r\nオープニング,BGM,x.mp3,,,,,,,\r\n"));
    await expect(page.getByTestId("table-import-errors")).toContainText("使えなくなりました");
    await page.getByRole("button", { name: "閉じる" }).click();

    // 後始末: 取り込んだ画面を空の設定に戻す(ファイルに出てくる画面を置き換える)
    await pick(page, buildScreensZip(screensCsv("オープニング,,,,,,,,,,", "説明,,,,,,,,,,", "デモ抽選,,,,,,,,,,", "本抽選,,,,,,,,,おまかせ,", "最終結果,,,,,,,,,,", "エンディング,,,,,,,,,,"), pagesCsv()));
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("table-import-close").click();
    await d.context.close();
  });
});
