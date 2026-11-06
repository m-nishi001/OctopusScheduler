import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { APIRequestContext, Page } from "@playwright/test";
import { makeBadgePng, makeWav, TUNES } from "../../scripts/seed-content.js";
import { adminRpc, expect, newDevice, test } from "./fixtures";

/**
 * 設定>イベントの CSV 一括取込・書き出し(素材つき)。イベントはこの端末(IndexedDB)にだけあり、素材は設定>アセットの一覧にある。
 * - 音楽・スクリーン(画像)・ページ遷移の行と素材フォルダを取り込む。素材は設定>アセットに1つずつ増える(同じ画像を2行が使っても1つ)。
 * - 書き出した CSV / ZIP をそのまま取り込み直すと全行「変更なし」。ZIP の素材は使われているものを1つずつ。
 * - 同じ名前で中身が違う素材は、同じアセットの差し替えになり、それを使う行だけが更新になる。
 * - 置き換えはファイルに無いイベントを消す(確認つき)が、設定>アセットの素材は消さない。
 * 画像・音声はテストの中で生成する(公開リポジトリのため)。
 */

const stamp = Date.now();
const BGM = `evt-csv-${stamp}.wav`;
const PIC = `evt-csv-${stamp}.png`;
const tempDirs: string[] = [];

/** 素材フォルダ(BGM と画像)を作ってパスを返す。BGM の中身は `tune` で変える。 */
function mediaDir(tune: Parameters<typeof makeWav>[0]): string {
  const dir = mkdtempSync(join(tmpdir(), "event-csv-e2e-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, BGM), makeWav(tune));
  writeFileSync(join(dir, PIC), makeBadgePng("#10b981", "#064e3b", { width: 64, height: 64 }));
  return dir;
}

const HEADER = "ID,種別,開始,終了,素材,表示,フォルダ,切替秒,切替効果,フェードアウト秒,遷移先URL";
const T = (n: number) => `2026-11-0${n} 09:00,2026-11-0${n} 10:00`;
const csvOf = (...lines: string[]) => [HEADER, ...lines].join("\r\n") + "\r\n";
const table = (text: string, name = "events.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf-8") });
const GOOD_LINES = [
  `evt-csv-1,音楽,${T(2)},${BGM},,,,,1.5,`,
  `evt-csv-2,スクリーン,${T(3)},${PIC},画像,,,,,`,
  `evt-csv-3,ページ遷移,${T(4)},,,,,,2,/quiz-admin`,
  `,スクリーン,${T(5)},${PIC},画像,,,,,`,
];

type Entry = { id: string; name: string; hash: string };
const serverAssets = async (request: APIRequestContext): Promise<Entry[]> => {
  const { json } = await adminRpc<{ json: string | null }>(request, "octopusScheduler_getAssetRecord", {});
  return json ? JSON.parse(json).data : [];
};
const mine = (entries: Entry[]) => entries.filter((e) => e.name === BGM || e.name === PIC);

async function openEvents(page: Page) {
  await page.goto("/#/settings?tab=events");
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

test.describe("イベントの CSV 取込・書き出し", () => {
  test("取込 → 書き出し → 取り込み直しは全行変更なし → 素材の差し替え → 置き換えで消すがアセットは残る", async ({ browser, request }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    await openEvents(page);
    await expect(page.getByTestId("table-count")).toHaveText("0件");

    // 取込: 4行(音楽・画像・ページ遷移・ID なしの画像)。同じ画像を2行が使っても素材は2つだけ
    await pickCsv(page, table(csvOf(...GOOD_LINES)), mediaDir(TUNES.draw));
    await expect(page.getByTestId("table-import-counts")).toContainText("追加 4 / 更新 0 / 変更なし 0 / 削除 0 / エラー 0");
    await expect(page.getByTestId("table-import-media-counts")).toContainText("追加 2");
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toContainText("追加 4", { timeout: 60_000 });
    await page.getByTestId("table-import-close").click();
    await expect(page.getByTestId("table-count")).toHaveText("4件");
    await expect(page.getByRole("row").filter({ hasText: "音楽" })).toHaveCount(1);
    await expect(page.getByRole("row").filter({ hasText: "スクリーン" })).toHaveCount(2);
    await expect(page.getByRole("row").filter({ hasText: "画面遷移" })).toHaveCount(1);

    // 設定>アセットに、素材が1つずつ増え、サーバーの一覧にも上がる
    await expect.poll(async () => mine(await serverAssets(request)).length, { timeout: 60_000 }).toBe(2);
    const before = mine(await serverAssets(request));

    // 書き出し(CSV): 取込と同じ書式。ID なしの行には ID が付いている
    const csvDownload = page.waitForEvent("download");
    await page.getByTestId("table-export").click();
    const csvFile = await csvDownload;
    expect(csvFile.suggestedFilename()).toBe("events.csv");
    const csvText = readFileSync(await csvFile.path(), "utf-8");
    expect(csvText.startsWith(`﻿${HEADER}`)).toBe(true);
    expect(csvText).toContain(`evt-csv-1,音楽,${T(2)},${BGM},,,,,1.5,`);
    expect(csvText).toContain(`evt-csv-3,ページ遷移,${T(4)},,,,,,2,/quiz-admin`);
    expect(csvText.split("\r\n").filter((l) => l.includes(PIC))).toHaveLength(2);

    // 書き出し(ZIP): 使われている素材を1つずつ
    await page.getByTestId("table-export-media").check();
    const zipDownload = page.waitForEvent("download");
    await page.getByTestId("table-export").click();
    const zipFile = await zipDownload;
    expect(zipFile.suggestedFilename()).toBe("events.zip");
    const zipBytes = readFileSync(await zipFile.path());
    const entries = Object.keys(unzipSync(new Uint8Array(zipBytes)));
    expect(entries.filter((n) => n.startsWith("media/")).sort()).toEqual([`media/${BGM}`, `media/${PIC}`].sort());

    // そのまま取り込み直すと、CSV も ZIP も全行「変更なし」(置き換えでも削除は 0)
    for (const file of [{ name: "events.zip", mimeType: "application/zip", buffer: zipBytes }, table(csvText)]) {
      await pickCsv(page, file);
      await page.getByTestId("table-import-replace").check();
      await expect(page.getByTestId("table-import-counts")).toContainText("追加 0 / 更新 0 / 変更なし 4 / 削除 0 / エラー 0");
      await expect(page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
      await page.getByRole("button", { name: "閉じる" }).click();
    }

    // 同じ名前で中身が違う BGM は、同じアセットの差し替え。それを使う音楽の行だけが更新になる
    await pickCsv(page, table(csvText), mediaDir(TUNES.prize));
    await expect(page.getByTestId("table-import-media-counts")).toContainText("差し替え 1");
    await expect(page.locator('[data-testid="table-import-row"][data-status="update"]')).toHaveCount(1);
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(page.getByTestId("table-import-result")).toContainText("更新 1", { timeout: 60_000 });
    await page.getByTestId("table-import-close").click();
    const bgmBefore = before.find((e) => e.name === BGM)!;
    await expect
      .poll(async () => mine(await serverAssets(request)).find((e) => e.name === BGM)?.hash, { timeout: 60_000 })
      .not.toBe(bgmBefore.hash);
    expect(mine(await serverAssets(request)).find((e) => e.name === BGM)!.id).toBe(bgmBefore.id);
    expect(mine(await serverAssets(request))).toHaveLength(2);

    // 置き換え: ファイルに無い2件(ページ遷移・ID を付けた画像)を消す。確認つき。アセットは消えない
    const kept = csvText.split("\r\n").filter((l) => l.replace(/^\uFEFF/, "") === HEADER || l.startsWith("evt-csv-1,") || l.startsWith("evt-csv-2,"));
    await pickCsv(page, table(kept.join("\r\n") + "\r\n"));
    await page.getByTestId("table-import-replace").check();
    await expect(page.locator('[data-testid="table-import-row"][data-status="delete"]')).toHaveCount(2);
    await expect(page.getByRole("dialog")).toContainText("素材は削除しません");
    await page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await page.getByRole("dialog").filter({ hasText: "削除の確認" }).getByRole("button", { name: "削除" }).click();
    await expect(page.getByTestId("table-import-result")).toContainText("削除 2", { timeout: 60_000 });
    await page.getByTestId("table-import-close").click();
    await expect(page.getByTestId("table-count")).toHaveText("2件");
    await expect(page.getByRole("row").filter({ hasText: "画面遷移" })).toHaveCount(0);

    await page.goto("/#/settings?tab=assets");
    await expect(page.getByRole("row").filter({ hasText: BGM })).toHaveCount(1);
    await expect(page.getByRole("row").filter({ hasText: PIC })).toHaveCount(1);
    expect(mine(await serverAssets(request))).toHaveLength(2);

    // 後始末: 取り込んだ素材を消す
    for (const name of [BGM, PIC]) {
      await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "削除" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "削除", exact: true }).click();
      await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
    }
    await expect.poll(async () => mine(await serverAssets(request)).length, { timeout: 60_000 }).toBe(0);
    await d.context.close();
  });

  test("エラーの行がある CSV は取り込めない(素材が無い・フォルダが無い・開始が終了以降・日時が読めない)", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    const { page } = d;
    await openEvents(page);
    const lines = [
      `err-1,音楽,${T(2)},nothing-${stamp}.wav,,,,,0,`,
      `err-2,スクリーン,${T(2)},,スライドショー,no-such-folder,5,フェード,,`,
      `err-3,ページ遷移,2026-11-02 10:00,2026-11-02 09:00,,,,,,0,/x`,
      `err-4,ページ遷移,あした,2026-11-02 09:00,,,,,,0,/x`,
      `ok-1,ページ遷移,2026/11/05 9:00,2026/11/05 10:00:30,,,,,,0,/x`,
    ];
    await pickCsv(page, table(csvOf(...lines)));
    await expect(page.getByTestId("table-import-counts")).toContainText("追加 1 / 更新 0 / 変更なし 0 / 削除 0 / エラー 4");
    const errors = page.locator('[data-testid="table-import-row"][data-status="error"]');
    await expect(errors).toHaveCount(4);
    await expect(errors.nth(0)).toContainText("見つかりません");
    await expect(errors.nth(1)).toContainText("フォルダ");
    await expect(errors.nth(2)).toContainText("開始が終了より後");
    await expect(errors.nth(3)).toContainText("日時を読めません");
    await expect(page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
    await page.getByRole("button", { name: "閉じる" }).click();
    await expect(page.getByTestId("table-count")).toHaveText("0件");
    await d.context.close();
  });
});
