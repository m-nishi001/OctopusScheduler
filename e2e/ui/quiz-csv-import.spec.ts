import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { APIRequestContext, Page } from "@playwright/test";
import { makeBadgePng, makeWav, TUNES } from "../../scripts/seed-content.js";
import { adminRpc, expect, newDevice, test } from "./fixtures";

/**
 * クイズ一覧の CSV 一括取込・書き出し(素材つき): 管理者が10問(同じBGMを共有)を CSV と素材フォルダで取り込む。
 * 同じBGMは1回だけ送られ、書き出した ZIP にも1つだけ入る。書き出したものをそのまま取り込み直すと全行「変更なし」。
 * 同じ名前で中身が違う素材は差し替えになり、それを使う行はすべて更新になる。置き換えで消えたクイズの素材はサーバーからも消える。
 * 画像・音声はテストの中で生成する(公開リポジトリのため)。
 */

const COUNT = 10;
const idOf = (n: number) => `csv-q-${String(n).padStart(2, "0")}`;
const titleOf = (n: number) => `取込クイズ${String(n).padStart(2, "0")}`;
const mine = (id: string) => id.startsWith("csv-q-");

const tempDirs: string[] = [];
/** 素材フォルダ(共有のBGMと、1枚の画像)を作ってパスを返す。BGM の中身は `tune` で変える。 */
function mediaDir(tune: Parameters<typeof makeWav>[0]): string {
  const dir = mkdtempSync(join(tmpdir(), "quiz-csv-e2e-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "shared-bgm.wav"), makeWav(tune));
  writeFileSync(join(dir, "option.png"), makeBadgePng("#3b82f6", "#1e3a8a", { width: 64, height: 64 }));
  return dir;
}

const header = "ID,タイトル,問題,制限時間(秒),正解(選択肢の番号),BGM,選択肢1,選択肢1画像,選択肢1色,選択肢2,選択肢2色";
const csvOf = () =>
  [header, ...Array.from({ length: COUNT }, (_, i) => `${idOf(i + 1)},${titleOf(i + 1)},問題${i + 1},20,2,shared-bgm.wav,はい,option.png,#3b82f6,いいえ,`)].join("\r\n") + "\r\n";
const table = (text: string, name = "quizzes.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf-8") });

type Record = { quizzes: Array<{ id: string; bgm: string | null }>; media: { [name: string]: { hash: string } } };
const serverRecord = async (request: APIRequestContext): Promise<Record> => {
  const { json } = await adminRpc<{ json: string | null }>(request, "quizGame_getRecord", {});
  return json ? JSON.parse(json).data : { quizzes: [], media: {} };
};
const myQuizzes = (r: Record) => r.quizzes.filter((q) => mine(q.id));
const blobExists = async (request: APIRequestContext, hash: string) =>
  (await adminRpc<{ existing: string[] }>(request, "quizGame_existsBlobs", { hashes: [hash] })).existing.length === 1;

/** クイズ一覧を開き、サーバーの件数と同じになる(最初の同期が済む)まで待つ。済む前に取り込むと、古い一覧を元にしてしまう。 */
async function openQuizList(page: Page, request: APIRequestContext) {
  await page.goto("/#/quiz-admin");
  const total = (await serverRecord(request)).quizzes.length;
  await expect(page.getByTestId("table-count")).toHaveText(`${total}件`);
}

function watchRpc(page: Page) {
  const counts = new Map<string, number>();
  page.on("request", (r) => {
    if (!r.url().endsWith("/rpc")) return;
    const name = String(r.postDataJSON()?.name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return { count: (name: string) => counts.get(name) ?? 0, reset: () => counts.clear() };
}

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

test.describe("クイズ一覧の CSV 取込・書き出し", () => {
  test("10問が同じBGMを使う CSV と素材フォルダを取り込む: BGM は1回だけ送られ、素材の索引も1つ", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const rpc = watchRpc(admin.page);
    await openQuizList(admin.page, request);

    // 選択肢の画像と色の検証: 正解が存在しない番号の行はエラー(取り込めない)
    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf() + `${idOf(11)},壊れた,問題,20,5,,はい,,,いいえ,\r\n`));
    await admin.page.getByTestId("table-import-media").setInputFiles(mediaDir(TUNES.quiz));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("エラー 1");
    await expect(admin.page.getByTestId("table-import-errors")).toHaveCount(0);
    await expect(admin.page.locator('[data-testid="table-import-row"][data-status="error"]')).toContainText("正解");
    await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();

    // 直して取り込む
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf()));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText(`追加 ${COUNT} / 更新 0 / 変更なし 0 / 削除 0 / エラー 0`);
    await expect(admin.page.getByTestId("table-import-media-counts")).toContainText("追加 2");
    rpc.reset();
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText(`追加 ${COUNT}`, { timeout: 60_000 });
    await admin.page.getByTestId("table-import-close").click();
    await expect(admin.page.getByRole("row").filter({ hasText: titleOf(1) })).toHaveCount(1);

    // サーバー: 10問、素材は BGM と画像の2つだけ。ファイルの送信は素材ごとに1回(BGM を10回送らない)、一覧の書き込みは1回
    await expect.poll(async () => myQuizzes(await serverRecord(request)).length, { timeout: 60_000 }).toBe(COUNT);
    const record = await serverRecord(request);
    expect(Object.keys(record.media).sort()).toEqual(expect.arrayContaining(["option.png", "shared-bgm.wav"]));
    expect(myQuizzes(record).every((q) => q.bgm === "shared-bgm.wav")).toBe(true);
    expect(rpc.count("quizGame_putBlob")).toBe(2);
    expect(rpc.count("quizGame_saveRecord")).toBe(1);
    expect(await blobExists(request, record.media["shared-bgm.wav"].hash)).toBe(true);
    await admin.context.close();
  });

  test("書き出した CSV / ZIP をそのまま取り込み直すと、全行「変更なし」。ZIP の BGM は1つ", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await openQuizList(admin.page, request);
    const record = await serverRecord(request);
    const total = record.quizzes.length;

    const csvDownload = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const csvFile = await csvDownload;
    expect(csvFile.suggestedFilename()).toBe("quizzes.csv");
    const csvText = readFileSync(await csvFile.path(), "utf-8");
    expect(csvText.startsWith("﻿ID,タイトル,問題,制限時間(秒),正解(選択肢の番号),BGM,正解BGM,景品名,景品画像,景品BGM,選択肢1,")).toBe(true);
    expect(csvText).toContain(`${idOf(1)},${titleOf(1)},問題1,20,2,shared-bgm.wav,`);

    await admin.page.getByTestId("table-export-media").check();
    const zipDownload = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const zipFile = await zipDownload;
    expect(zipFile.suggestedFilename()).toBe("quizzes.zip");
    const zipBytes = readFileSync(await zipFile.path());
    const entries = Object.keys(unzipSync(new Uint8Array(zipBytes)));
    expect(entries.filter((n) => n === "media/shared-bgm.wav")).toHaveLength(1);
    expect(entries.filter((n) => n.startsWith("media/"))).toHaveLength(Object.keys(record.media).length);

    for (const file of [{ name: "quizzes.zip", mimeType: "application/zip", buffer: zipBytes }, table(csvText)]) {
      await admin.page.getByTestId("table-import-open").click();
      await admin.page.getByTestId("table-import-table").setInputFiles(file);
      await expect(admin.page.getByTestId("table-import-counts")).toContainText(`追加 0 / 更新 0 / 変更なし ${total} / 削除 0 / エラー 0`);
      await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
      await admin.page.getByRole("button", { name: "閉じる" }).click();
    }
    await admin.context.close();
  });

  test("同じ名前で中身が違う BGM は差し替えになり、それを使う10問がすべて更新になる", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await openQuizList(admin.page, request);
    const before = (await serverRecord(request)).media["shared-bgm.wav"].hash;

    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf()));
    await admin.page.getByTestId("table-import-media").setInputFiles(mediaDir(TUNES.prize));
    await expect(admin.page.getByTestId("table-import-media-counts")).toContainText("差し替え 1");
    await expect(admin.page.locator('[data-testid="table-import-row"][data-status="update"]')).toHaveCount(COUNT);
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText(`更新 ${COUNT}`, { timeout: 60_000 });
    await admin.page.getByTestId("table-import-close").click();

    // 古い BGM はサーバーから消え、10問とも新しい BGM を指す
    await expect.poll(async () => (await serverRecord(request)).media["shared-bgm.wav"].hash, { timeout: 60_000 }).not.toBe(before);
    expect(await blobExists(request, before)).toBe(false);
    await admin.context.close();
  });

  test("置き換え: ファイルに無いクイズを消す(確認つき)。使われなくなった素材はサーバーから消える。選択して削除もできる", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await openQuizList(admin.page, request);

    // いまの書き出し(他のクイズも含む)から、5問を外して置き換える。BGM はまだ残りの5問が使う
    const download = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const all = readFileSync(await (await download).path(), "utf-8");
    const without = (ids: string[]) =>
      all
        .split("\r\n")
        .filter((line) => !ids.some((id) => line.startsWith(`${id},`)))
        .join("\r\n");
    const doomed = Array.from({ length: 5 }, (_, i) => idOf(i + 1));
    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(without(doomed)));
    await admin.page.getByTestId("table-import-replace").check();
    await expect(admin.page.locator('[data-testid="table-import-row"][data-status="delete"]')).toHaveCount(5);
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await admin.page.getByRole("dialog").filter({ hasText: "削除の確認" }).getByRole("button", { name: "削除" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText("削除 5", { timeout: 60_000 });
    await admin.page.getByTestId("table-import-close").click();
    await expect.poll(async () => myQuizzes(await serverRecord(request)).length, { timeout: 60_000 }).toBe(5);
    const bgmHash = (await serverRecord(request)).media["shared-bgm.wav"].hash;
    expect(await blobExists(request, bgmHash)).toBe(true);

    // 残りの5問を、一覧で選択して削除する。BGM を使うクイズが無くなり、素材も索引とサーバーから消える
    for (let n = 6; n <= COUNT; n++) await admin.page.getByRole("row").filter({ hasText: titleOf(n) }).getByRole("checkbox").check();
    await admin.page.getByRole("button", { name: "選択を削除(5)" }).click();
    await admin.page.getByRole("dialog").getByRole("button", { name: "削除", exact: true }).click();
    await expect(admin.page.getByRole("row").filter({ hasText: "取込クイズ" })).toHaveCount(0);
    await expect.poll(async () => myQuizzes(await serverRecord(request)).length, { timeout: 60_000 }).toBe(0);
    await expect.poll(async () => "shared-bgm.wav" in (await serverRecord(request)).media, { timeout: 60_000 }).toBe(false);
    expect(await blobExists(request, bgmHash)).toBe(false);
    await admin.context.close();
  });
});
