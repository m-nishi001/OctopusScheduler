import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { APIRequestContext, Page } from "@playwright/test";
import { makeBadgePng, makeWav, TUNES } from "../../scripts/seed-content.js";
import { adminRpc, expect, newDevice, test } from "./fixtures";

/**
 * ジャックポットの景品・メンバーの CSV 一括取込・書き出し(素材つき)。
 * 景品: 10件が同じ画像と BGM を共有する CSV と素材フォルダを取り込む。同じ素材は1回だけ送られ、書き出した ZIP にも1つだけ入る。
 *   書き出したものをそのまま取り込み直すと全行「変更なし」。置き換えで消えた景品の素材はサーバーからも消える(景品と画面設定が共有する素材は残る)。
 * クイズと同じファイル名でも別々に保存される(モジュールをまたいで共有しない)。
 * メンバー: ID をキーにランク・当選しやすさを設定し、名簿にいない ID は名前があれば名簿に追加する(名簿の人は削除しない)。
 * 画像・音声はテストの中で生成する(公開リポジトリのため)。
 */

const COUNT = 10;
const idOf = (n: number) => `csv-jp-${String(n).padStart(2, "0")}`;
const nameOf = (n: number) => `取込景品${String(n).padStart(2, "0")}`;
const mine = (id: string) => id.startsWith("csv-jp-");
/** クイズと同じ名前の素材(中身は別)。 */
const SHARED_IMAGE = "jp-shared.png";
const SHARED_BGM = "jp-shared.wav";

const tempDirs: string[] = [];
/** 素材フォルダ(共有の画像と BGM)を作ってパスを返す。BGM の中身は `tune` で、画像の色は `color` で変える。 */
function mediaDir(tune: Parameters<typeof makeWav>[0], color = "#3b82f6"): string {
  const dir = mkdtempSync(join(tmpdir(), "jackpot-csv-e2e-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, SHARED_BGM), makeWav(tune));
  writeFileSync(join(dir, SHARED_IMAGE), makeBadgePng(color, "#1e3a8a", { width: 64, height: 64 }));
  return dir;
}

const header = "ID,名前,当選確率の重み,アニメーション,画像1,BGM1";
const csvOf = () =>
  [header, ...Array.from({ length: COUNT }, (_, i) => `${idOf(i + 1)},${nameOf(i + 1)},20,スロット,${SHARED_IMAGE},${SHARED_BGM}`)].join("\r\n") + "\r\n";
const table = (text: string, name = "prizes.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf-8") });

type Media = { [name: string]: { hash: string } };
type JackpotRecord = { prizes: Array<{ id: string; image?: string; bgm1?: string; order: number }>; screens: unknown[]; media: Media };
const serverRecord = async (request: APIRequestContext): Promise<JackpotRecord> => {
  const { json } = await adminRpc<{ json: string | null }>(request, "jackpotGame_getRecord", {});
  return json ? JSON.parse(json).data : { prizes: [], screens: [], media: {} };
};
const quizMedia = async (request: APIRequestContext): Promise<Media> => {
  const { json } = await adminRpc<{ json: string | null }>(request, "quizGame_getRecord", {});
  return json ? JSON.parse(json).data.media : {};
};
const myPrizes = (r: JackpotRecord) => r.prizes.filter((p) => mine(p.id));
const blobExists = async (request: APIRequestContext, endpoint: string, hash: string) =>
  (await adminRpc<{ existing: string[] }>(request, endpoint, { hashes: [hash] })).existing.length === 1;

/** 景品一覧を開き、サーバーの件数と同じになる(最初の同期が済む)まで待つ。済む前に取り込むと、古い一覧を元にしてしまう。 */
async function openPrizeList(page: Page, request: APIRequestContext) {
  await page.goto("/#/execute/jackpot-admin/prizes");
  const total = (await serverRecord(request)).prizes.length;
  await expect(page.getByTestId("table-count")).toHaveText(`${total}件`, { timeout: 60_000 });
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

test.describe("景品の CSV 取込・書き出し", () => {
  test("10件が同じ画像と BGM を使う CSV と素材フォルダを取り込む: 素材は1回ずつだけ送られ、素材の索引も1つずつ", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const rpc = watchRpc(admin.page);
    await openPrizeList(admin.page, request);

    // 重みが範囲外の行はエラー(取り込めない)
    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf() + `${idOf(11)},壊れた景品,0,,,\r\n`));
    await admin.page.getByTestId("table-import-media").setInputFiles(mediaDir(TUNES.draw));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("エラー 1");
    await expect(admin.page.locator('[data-testid="table-import-row"][data-status="error"]')).toContainText("当選確率の重み");
    await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();

    // 直して取り込む
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf()));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText(`追加 ${COUNT} / 更新 0 / 変更なし 0 / 削除 0 / エラー 0`);
    await expect(admin.page.getByTestId("table-import-media-counts")).toContainText("追加 2");
    rpc.reset();
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText(`追加 ${COUNT}`, { timeout: 60_000 });
    await admin.page.getByTestId("table-import-close").click();
    await expect(admin.page.getByRole("row").filter({ hasText: nameOf(1) })).toHaveCount(1);

    // サーバー: 10件、素材は画像と BGM の2つだけ。ファイルの送信は素材ごとに1回、レコードの書き込みは1回
    await expect.poll(async () => myPrizes(await serverRecord(request)).length, { timeout: 60_000 }).toBe(COUNT);
    const record = await serverRecord(request);
    expect(Object.keys(record.media).sort()).toEqual(expect.arrayContaining([SHARED_BGM, SHARED_IMAGE]));
    expect(myPrizes(record).every((p) => p.image === SHARED_IMAGE && p.bgm1 === SHARED_BGM)).toBe(true);
    expect(rpc.count("jackpotGame_putBlob")).toBe(2);
    expect(rpc.count("jackpotGame_saveRecord")).toBe(1);
    expect(await blobExists(request, "jackpotGame_existsBlobs", record.media[SHARED_BGM].hash)).toBe(true);
    await admin.context.close();
  });

  test("書き出した CSV / ZIP をそのまま取り込み直すと、全行「変更なし」。ZIP の素材は1つずつ", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await openPrizeList(admin.page, request);
    const record = await serverRecord(request);
    const total = record.prizes.length;

    const csvDownload = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const csvFile = await csvDownload;
    expect(csvFile.suggestedFilename()).toBe("prizes.csv");
    const csvText = readFileSync(await csvFile.path(), "utf-8");
    expect(csvText.startsWith("﻿ID,名前,当選確率の重み,アニメーション,画像1,画像2,当選画像1,当選画像2,BGM1,BGM2")).toBe(true);
    expect(csvText).toContain(`${idOf(1)},${nameOf(1)},20,スロット,${SHARED_IMAGE},`);

    await admin.page.getByTestId("table-export-media").check();
    const zipDownload = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const zipFile = await zipDownload;
    expect(zipFile.suggestedFilename()).toBe("prizes.zip");
    const zipBytes = readFileSync(await zipFile.path());
    const entries = Object.keys(unzipSync(new Uint8Array(zipBytes)));
    expect(entries.filter((n) => n === `media/${SHARED_IMAGE}`)).toHaveLength(1);
    expect(entries.filter((n) => n.startsWith("media/"))).toHaveLength(Object.keys(record.media).length);

    for (const file of [{ name: "prizes.zip", mimeType: "application/zip", buffer: zipBytes }, table(csvText)]) {
      await admin.page.getByTestId("table-import-open").click();
      await admin.page.getByTestId("table-import-table").setInputFiles(file);
      await expect(admin.page.getByTestId("table-import-counts")).toContainText(`追加 0 / 更新 0 / 変更なし ${total} / 削除 0 / エラー 0`);
      await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
      await admin.page.getByRole("button", { name: "閉じる" }).click();
    }
    await admin.context.close();
  });

  test("同じ名前で中身が違う素材は差し替えになり、それを使う10件がすべて更新になる", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await openPrizeList(admin.page, request);
    const before = (await serverRecord(request)).media[SHARED_BGM].hash;

    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf()));
    await admin.page.getByTestId("table-import-media").setInputFiles(mediaDir(TUNES.prize));
    await expect(admin.page.getByTestId("table-import-media-counts")).toContainText("差し替え 1");
    await expect(admin.page.locator('[data-testid="table-import-row"][data-status="update"]')).toHaveCount(COUNT);
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText(`更新 ${COUNT}`, { timeout: 60_000 });
    await admin.page.getByTestId("table-import-close").click();

    // 古い BGM はサーバーから消え、10件とも新しい BGM を指す
    await expect.poll(async () => (await serverRecord(request)).media[SHARED_BGM].hash, { timeout: 60_000 }).not.toBe(before);
    expect(await blobExists(request, "jackpotGame_existsBlobs", before)).toBe(false);
    await admin.context.close();
  });

  test("クイズと同じファイル名の素材でも、別々に保存される(モジュールをまたいで共有しない)", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/quiz-admin");
    const quizTotal = (await adminRpc<{ json: string | null }>(request, "quizGame_getRecord", {})).json;
    const count = quizTotal ? JSON.parse(quizTotal).data.quizzes.length : 0;
    await expect(admin.page.getByTestId("table-count")).toHaveText(`${count}件`, { timeout: 60_000 });

    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(`ID,タイトル,問題,BGM,選択肢1\r\ncsv-jpq-1,同名素材のクイズ,問題,${SHARED_BGM},はい\r\n`, "quizzes.csv"));
    await admin.page.getByTestId("table-import-media").setInputFiles(mediaDir(TUNES.quiz, "#ef4444"));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("追加 1 / 更新 0 / 変更なし 0 / 削除 0 / エラー 0");
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText("追加 1", { timeout: 60_000 });
    await admin.page.getByTestId("table-import-close").click();

    // 同じ名前の素材が、クイズ側とジャックポット側に、別のファイルとして1つずつある
    await expect.poll(async () => SHARED_BGM in (await quizMedia(request)), { timeout: 60_000 }).toBe(true);
    const quizHash = (await quizMedia(request))[SHARED_BGM].hash;
    const jackpotHash = (await serverRecord(request)).media[SHARED_BGM].hash;
    expect(quizHash).not.toBe(jackpotHash);
    expect(await blobExists(request, "quizGame_existsBlobs", quizHash)).toBe(true);
    expect(await blobExists(request, "jackpotGame_existsBlobs", jackpotHash)).toBe(true);
    // 相手のファイルは、自分のストアには無い
    expect(await blobExists(request, "jackpotGame_existsBlobs", quizHash)).toBe(false);
    expect(await blobExists(request, "quizGame_existsBlobs", jackpotHash)).toBe(false);
    await admin.context.close();
  });

  test("置き換え: ファイルに無い景品を消す(確認つき)。使われなくなった素材はサーバーから消える。選択して削除もできる。クイズの同名の素材は残る", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await openPrizeList(admin.page, request);

    // いまの書き出し(他の景品も含む)から、5件を外して置き換える。素材はまだ残りの5件が使う
    const download = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const all = readFileSync(await (await download).path(), "utf-8");
    const doomed = Array.from({ length: 5 }, (_, i) => idOf(i + 1));
    const without = all
      .split("\r\n")
      .filter((line) => !doomed.some((id) => line.startsWith(`${id},`)))
      .join("\r\n");
    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(without));
    await admin.page.getByTestId("table-import-replace").check();
    await expect(admin.page.locator('[data-testid="table-import-row"][data-status="delete"]')).toHaveCount(5);
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await admin.page.getByRole("dialog").filter({ hasText: "削除の確認" }).getByRole("button", { name: "削除" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText("削除 5", { timeout: 60_000 });
    await admin.page.getByTestId("table-import-close").click();
    await expect.poll(async () => myPrizes(await serverRecord(request)).length, { timeout: 60_000 }).toBe(5);
    const record = await serverRecord(request);
    const imageHash = record.media[SHARED_IMAGE].hash;
    expect(await blobExists(request, "jackpotGame_existsBlobs", imageHash)).toBe(true);
    // 置き換えでは、ファイルの行の順が並び順になる
    expect(myPrizes(record).map((p) => p.id)).toEqual(Array.from({ length: 5 }, (_, i) => idOf(i + 6)));

    // 残りの5件を、一覧で選択して削除する。素材を使う景品が無くなり、索引とサーバーから消える
    for (let n = 6; n <= COUNT; n++) await admin.page.getByRole("row").filter({ hasText: nameOf(n) }).getByRole("checkbox").check();
    await admin.page.getByRole("button", { name: "選択を削除(5)" }).click();
    await admin.page.getByRole("dialog").getByRole("button", { name: "削除", exact: true }).click();
    await expect(admin.page.getByRole("row").filter({ hasText: "取込景品" })).toHaveCount(0);
    await expect.poll(async () => myPrizes(await serverRecord(request)).length, { timeout: 60_000 }).toBe(0);
    await expect.poll(async () => SHARED_IMAGE in (await serverRecord(request)).media, { timeout: 60_000 }).toBe(false);
    expect(await blobExists(request, "jackpotGame_existsBlobs", imageHash)).toBe(false);

    // クイズ側の同名の素材は残る。後始末としてそのクイズを消す
    expect(SHARED_BGM in (await quizMedia(request))).toBe(true);
    await admin.page.goto("/#/quiz-admin");
    const quizRow = admin.page.getByRole("row").filter({ hasText: "同名素材のクイズ" });
    await expect(quizRow).toHaveCount(1, { timeout: 60_000 });
    await quizRow.getByRole("checkbox").check();
    await admin.page.getByRole("button", { name: "選択を削除(1)" }).click();
    await admin.page.getByRole("dialog").getByRole("button", { name: "削除", exact: true }).click();
    await expect.poll(async () => SHARED_BGM in (await quizMedia(request)), { timeout: 60_000 }).toBe(false);
    await admin.context.close();
  });
});

const MEMBER_IDS = ["csv-jpm-1", "csv-jpm-2"];
const NEW_MEMBER = "csv-jpm-new";
type ExtraRow = { memberId: string; rank: number; weight?: number };
const serverExtras = async (request: APIRequestContext): Promise<ExtraRow[]> => {
  const { json } = await adminRpc<{ json: string | null }>(request, "jackpotGame_getJson", "member-extras.json");
  return json ? JSON.parse(json).data : [];
};

test.describe("メンバーの CSV 取込・書き出し", () => {
  test.beforeAll(async ({ request }) => {
    for (const [i, id] of MEMBER_IDS.entries()) await adminRpc(request, "accounts_addMember", { id, name: `CSVメンバー${i + 1}` });
  });
  test.afterAll(async ({ request }) => {
    for (const id of [...MEMBER_IDS, NEW_MEMBER]) await adminRpc(request, "accounts_deleteMember", { id }).catch(() => undefined);
  });

  test("ランク・当選しやすさを ID をキーに設定する。名簿にいない ID は、名前があれば名簿に追加する。書き出し直すと全行「変更なし」", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    const rpc = watchRpc(admin.page);
    await admin.page.goto("/#/execute/jackpot-admin/members");
    const rosterSize = (await adminRpc<unknown[]>(request, "accounts_listMembers", {})).length;
    await expect(admin.page.getByTestId("table-count")).toHaveText(`${rosterSize}件`, { timeout: 60_000 });

    await admin.page.getByTestId("table-import-open").click();
    // 置き換え(名簿の削除)は選べない
    await expect(admin.page.getByTestId("table-import-replace")).toHaveCount(0);
    const csv = `ID,名前,ランク,当選しやすさ\r\n${MEMBER_IDS[0]},,2,77\r\n${MEMBER_IDS[1]},,,5\r\n${NEW_MEMBER},新しい人,3,40\r\n`;
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csv, "jackpot-members.csv"));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("追加 1 / 更新 2 / 変更なし 0 / エラー 0");
    rpc.reset();
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText("追加 1 / 更新 2", { timeout: 60_000 });
    await admin.page.getByTestId("table-import-close").click();
    // 名簿の書き込みは1回。名簿の人は消えていない
    expect(rpc.count("accounts_applyRoster")).toBe(1);
    const roster = await adminRpc<Array<{ id: string; name: string }>>(request, "accounts_listMembers", {});
    expect(roster.some((m) => m.id === NEW_MEMBER && m.name === "新しい人")).toBe(true);
    expect(roster).toHaveLength(rosterSize + 1);

    const row = (id: string) => admin.page.getByRole("row").filter({ hasText: id === NEW_MEMBER ? "新しい人" : `CSVメンバー${MEMBER_IDS.indexOf(id) + 1}` });
    await expect(row(MEMBER_IDS[0])).toContainText("77");
    await expect(row(MEMBER_IDS[1])).toContainText("5");
    await expect(row(NEW_MEMBER)).toContainText("40");
    // 拡張設定はサーバーへも同期される
    await expect
      .poll(async () => (await serverExtras(request)).find((e) => e.memberId === MEMBER_IDS[0])?.rank, { timeout: 60_000 })
      .toBe(2);
    const extras = await serverExtras(request);
    expect(extras.find((e) => e.memberId === MEMBER_IDS[1])).toMatchObject({ weight: 5 });
    expect(extras.find((e) => e.memberId === NEW_MEMBER)).toMatchObject({ rank: 3, weight: 40 });

    // 書き出し直すと全行「変更なし」
    const total = rosterSize + 1;
    await expect(admin.page.getByTestId("table-count")).toHaveText(`${total}件`);
    const download = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("jackpot-members.csv");
    const text = readFileSync(await file.path(), "utf-8");
    expect(text.startsWith("﻿ID,名前,写真,ランク,当選しやすさ")).toBe(true);
    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(text, "jackpot-members.csv"));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText(`追加 0 / 更新 0 / 変更なし ${total} / エラー 0`);
    await admin.page.getByRole("button", { name: "閉じる" }).click();
    await admin.context.close();
  });
});
