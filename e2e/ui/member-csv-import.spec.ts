import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { Page } from "@playwright/test";
import { makeBadgePng } from "../../scripts/seed-content.js";
import { ADMIN_ID, adminRpc, expect, newDevice, test } from "./fixtures";

/**
 * 名簿の CSV 一括取込・書き出し(写真つき): 管理者が名簿エディタで、40人分の CSV と画像フォルダを渡して取り込み、
 * 書き出した CSV / ZIP をそのまま取り込み直すと全行「変更なし」になる。
 * 取込は、写真を並列に送ってから名簿を1回だけ書く。回数制限(429)は出ない。
 * 撮影先(E2E_EVIDENCE_DIR)を指定すると、画面のスクリーンショットと取込の統計(import-stats.json)をそこへ保存する。
 */

const COUNT = 40;
const evidenceDir = process.env.E2E_EVIDENCE_DIR;
const idOf = (n: number) => `csv-e2e-${String(n).padStart(2, "0")}`;
const nameOf = (n: number) => `取込テスト${String(n).padStart(2, "0")}`;
const allIds = Array.from({ length: COUNT }, (_, i) => idOf(i + 1));

/** n 番目の人の写真: 色が人ごとに違う(=別の写真)。数人は実寸に近い大きな写真で、縮小されることも確かめる。 */
function photoOf(n: number) {
  const hue = (n * 47) % 360;
  const hex = (h: number, l: number) => {
    const k = (v: number) => (v + h / 30) % 12;
    const a = 0.6 * Math.min(l, 1 - l);
    const f = (v: number) => l - a * Math.max(-1, Math.min(k(v) - 3, Math.min(9 - k(v), 1)));
    return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
  };
  const big = n % 10 === 0;
  return makeBadgePng(hex(hue, 0.55), hex((hue + 60) % 360, 0.3), big ? { width: 2400, height: 1800 } : { width: 800 + n, height: 600 });
}

const csvOf = (rows: Array<[string, string, string]>) => ["ID,名前,写真", ...rows.map((r) => r.join(","))].join("\r\n") + "\r\n";
const table = (text: string, name = "members.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf-8") });
/** 画像を入れたフォルダを作って、そのパスを返す(画像フォルダの選択は、フォルダのパスで渡す)。 */
const tempDirs: string[] = [];
function imageDir(ns: number[]): string {
  const dir = mkdtempSync(join(tmpdir(), "csv-e2e-"));
  tempDirs.push(dir);
  for (const n of ns) writeFileSync(join(dir, `${idOf(n)}.png`), photoOf(n));
  return dir;
}

type Rpc = Parameters<typeof adminRpc>[0];
const roster = async (request: Rpc) =>
  (await adminRpc<Array<{ id: string; name: string; photo?: string }>>(request, "accounts_listMembers", {})).filter((m) => m.id.startsWith("csv-e2e-"));

test.describe.configure({ mode: "serial" });

test.afterAll(async ({ request }) => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  for (const id of [...allIds, idOf(99)]) await adminRpc(request, "accounts_deleteMember", { id }).catch(() => undefined);
});

async function openImportDialog(page: Page) {
  await page.goto("/#/settings?tab=members");
  await page.getByTestId("table-import-open").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** RPC の名前ごとの回数・同時に飛んでいた最大数・429 の数を数える。 */
function watchRpc(page: Page) {
  const counts = new Map<string, number>();
  const inFlight = new Map<string, number>();
  const maxInFlight = new Map<string, number>();
  const bump = <K>(m: Map<K, number>, k: K, d: number) => m.set(k, (m.get(k) ?? 0) + d);
  const nameByRequest = new WeakMap<object, string>();
  let rateLimited = 0;
  page.on("request", (r) => {
    if (!r.url().endsWith("/rpc")) return;
    const name = String(r.postDataJSON()?.name);
    nameByRequest.set(r, name);
    bump(counts, name, 1);
    bump(inFlight, name, 1);
    maxInFlight.set(name, Math.max(maxInFlight.get(name) ?? 0, inFlight.get(name) ?? 0));
  });
  const done = (r: { url(): string }) => {
    const name = nameByRequest.get(r as object);
    if (name) bump(inFlight, name, -1);
  };
  page.on("requestfinished", done);
  page.on("requestfailed", done);
  page.on("response", (res) => {
    if (res.url().endsWith("/rpc") && res.status() === 429) rateLimited++;
  });
  return {
    count: (name: string) => counts.get(name) ?? 0,
    maxInFlight: (name: string) => maxInFlight.get(name) ?? 0,
    rateLimited: () => rateLimited,
  };
}

test.describe("名簿の CSV 取込・書き出し", () => {
  test("40人分の CSV と画像フォルダを取り込む: プレビューで行ごとの結果、写真は並列に送り、名簿の書き込みは1回", async ({ browser, request }) => {
    // 準備: 既存の人(名前が違う=更新、写真が既にある=変更なし)
    await adminRpc(request, "accounts_addMember", { id: idOf(1), name: "旧名前" });
    await adminRpc(request, "accounts_addMember", { id: idOf(2), name: nameOf(2) });
    const admin = await newDevice(browser, { signedIn: true });
    const rpc = watchRpc(admin.page);
    await openImportDialog(admin.page);

    // 40行 + 画像が無い1行 + 名前が空の1行
    const rows: Array<[string, string, string]> = allIds.map((id, i) => [id, nameOf(i + 1), `${id}.png`]);
    rows.push(["csv-e2e-missing", "画像なし", "nothing.png"], ["csv-e2e-noname", "", ""]);
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf(rows)));
    await admin.page.getByTestId("table-import-media").setInputFiles(imageDir(allIds.map((_, i) => i + 1)));

    // プレビュー: 追加 38(うち1行は写真だけ変わる更新 = 2人目も画像があるので更新扱い)、更新 2、エラー 2。エラーがあると取り込めない
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("追加 38 / 更新 2 / 変更なし 0 / 削除 0 / エラー 2");
    const errorRows = admin.page.locator('[data-testid="table-import-row"][data-status="error"]');
    await expect(errorRows).toHaveCount(2);
    await expect(errorRows.nth(0)).toContainText("nothing.png");
    await expect(errorRows.nth(1)).toContainText("名前が空です");
    await expect(admin.page.getByTestId("table-import-blocked")).toBeVisible();
    await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
    // ファイルを直して選び直す(エラーの2行を除く)
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf(rows.slice(0, COUNT))));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("追加 38 / 更新 2 / 変更なし 0 / 削除 0 / エラー 0");
    // プレビューの間は何も書いていない
    expect(rpc.count("accounts_putMemberPhoto")).toBe(0);
    expect(await roster(request)).toHaveLength(2);
    if (evidenceDir) await admin.page.screenshot({ path: `${evidenceDir}/import-preview.png`, fullPage: true });

    const started = Date.now();
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText("追加 38 / 更新 2", { timeout: 60_000 });
    const elapsedMs = Date.now() - started;
    const details = await admin.page.getByTestId("table-import-details").innerText();
    if (evidenceDir) await admin.page.screenshot({ path: `${evidenceDir}/import-result.png`, fullPage: true });

    // 写真は並列に送られ、存在確認は1回、名簿の書き込みも1回。回数制限には掛からない
    expect(rpc.count("accounts_existsMemberPhotos")).toBe(1);
    expect(rpc.count("accounts_putMemberPhoto")).toBe(COUNT);
    expect(rpc.count("accounts_applyRoster")).toBe(1);
    expect(rpc.maxInFlight("accounts_putMemberPhoto")).toBeGreaterThan(1);
    expect(rpc.maxInFlight("accounts_putMemberPhoto")).toBeLessThanOrEqual(6);
    expect(rpc.rateLimited()).toBe(0);
    expect(details).toContain("回数制限(429)で待った回数 0");

    // 名簿: 40人に写真のハッシュが付き、既存の人は上書き。エラーの行は入っていない
    const members = await roster(request);
    expect(members).toHaveLength(COUNT);
    expect(members.every((m) => /^[0-9a-f]{16}$/.test(m.photo ?? ""))).toBe(true);
    expect(members.find((m) => m.id === idOf(1))?.name).toBe(nameOf(1));
    expect(new Set(members.map((m) => m.photo)).size).toBe(COUNT);

    // 名簿エディタにも写真が並ぶ(取込後すぐに)
    await admin.page.getByTestId("table-import-close").click();
    await expect(admin.page.getByTestId("member-thumb").first()).toBeVisible();
    await expect.poll(() => admin.page.locator("tbody tr", { hasText: "取込テスト" }).getByTestId("member-thumb").count()).toBe(COUNT);
    // 大きい写真は縮小されている
    const size = await admin.page
      .locator("tbody tr", { hasText: nameOf(10) })
      .getByTestId("member-thumb")
      .evaluate((img: HTMLImageElement) => Math.max(img.naturalWidth, img.naturalHeight));
    expect(size).toBe(512);
    if (evidenceDir) {
      await admin.page.screenshot({ path: `${evidenceDir}/roster-after-import.png`, fullPage: true });
      writeFileSync(
        `${evidenceDir}/import-stats.json`,
        JSON.stringify(
          {
            members: COUNT,
            elapsedMsFromClickToResult: elapsedMs,
            existsCalls: rpc.count("accounts_existsMemberPhotos"),
            putCalls: rpc.count("accounts_putMemberPhoto"),
            applyRosterCalls: rpc.count("accounts_applyRoster"),
            maxConcurrentPuts: rpc.maxInFlight("accounts_putMemberPhoto"),
            http429: rpc.rateLimited(),
            dialogDetails: details.split("\n"),
          },
          null,
          2
        )
      );
    }

    // もう一度同じ内容を取り込むと、全行「変更なし」(エラーの2行を除く)。写真は送り直さない
    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf(rows.slice(0, COUNT))));
    await admin.page.getByTestId("table-import-media").setInputFiles(imageDir(allIds.map((_, i) => i + 1)));
    // 元の画像は縮小前なので、名簿の写真とは別物 = 「更新」(縮小後は同じハッシュ → 送信 0 枚)
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("追加 0 / 更新 40 / 変更なし 0 / 削除 0 / エラー 0");
    const putsBefore = rpc.count("accounts_putMemberPhoto");
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-details")).toContainText("送信 0枚 / サーバーに既にあった 40枚");
    expect(rpc.count("accounts_putMemberPhoto")).toBe(putsBefore);
    expect(await roster(request)).toEqual(members);
    await admin.context.close();
  });

  test("書き出した CSV / 写真つき ZIP をそのまま取り込み直すと、全行「変更なし」", async ({ browser, request }) => {
    const before = await roster(request);
    expect(before).toHaveLength(COUNT);
    // 書き出しには名簿の全員(取込テスト以外の人も)が入る
    const total = (await adminRpc<unknown[]>(request, "accounts_listMembers", {})).length;
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/settings?tab=members");
    await expect(admin.page.locator("tbody tr", { hasText: "取込テスト" }).first()).toBeVisible();

    // CSV のみ
    const csvDownload = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const csvFile = await csvDownload;
    expect(csvFile.suggestedFilename()).toBe("members.csv");
    const { readFileSync } = await import("node:fs");
    const csvText = readFileSync(await csvFile.path(), "utf-8");
    expect(csvText.startsWith("﻿ID,名前,写真")).toBe(true);
    expect(csvText).toContain(`${idOf(1)},${nameOf(1)},\r\n`);

    // 写真つき ZIP: members.csv と media/<id>.<拡張子>(40枚)
    await admin.page.getByTestId("table-export-media").check();
    const zipDownload = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const zipFile = await zipDownload;
    expect(zipFile.suggestedFilename()).toBe("members.zip");
    const zipBytes = readFileSync(await zipFile.path());
    const entries = unzipSync(new Uint8Array(zipBytes));
    const photoEntries = Object.keys(entries).filter((n) => n.startsWith("media/"));
    expect(photoEntries).toHaveLength(COUNT);
    expect(photoEntries.every((n) => /^media\/csv-e2e-\d\d\.(webp|jpg)$/.test(n))).toBe(true);
    expect(new TextDecoder().decode(entries["members.csv"])).toContain(`${idOf(1)},${nameOf(1)},${idOf(1)}.`);

    // 取り込み直し(ZIP 1つだけ。ほかのメンバーは CSV に無いが消えない)
    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles({ name: "members.zip", mimeType: "application/zip", buffer: zipBytes });
    await expect(admin.page.getByTestId("table-import-counts")).toContainText(`追加 0 / 更新 0 / 変更なし ${total} / 削除 0 / エラー 0`);
    await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
    if (evidenceDir) await admin.page.screenshot({ path: `${evidenceDir}/reimport-unchanged.png`, fullPage: true });
    await admin.page.getByRole("button", { name: "閉じる" }).click();

    // CSV だけでも往復で変更なし
    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles({ name: "members.csv", mimeType: "text/csv", buffer: readFileSync(await csvFile.path()) });
    await expect(admin.page.getByTestId("table-import-counts")).toContainText(`追加 0 / 更新 0 / 変更なし ${total}`);
    expect(await roster(request)).toEqual(before);
    await admin.context.close();
  });

  test("CSV が壊れていれば理由を出し、取り込めない。取込んだ写真は参加者のログインでも読める", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await openImportDialog(admin.page);
    await admin.page.getByTestId("table-import-table").setInputFiles(table("名前,写真\r\n誰か,x.png\r\n"));
    await expect(admin.page.getByTestId("table-import-errors")).toContainText("ID");
    await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
    await admin.context.close();

    const target = (await roster(request)).find((m) => m.id === idOf(3))!;
    const key = (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id: target.id })).key;
    const login = await request.post("/rpc", { data: { name: "accounts_loginWithKey", args: { id: target.id, key } } });
    const token = (await login.json()).data.token as string;
    const read = await request.post("/rpc", { data: { name: "accounts_getMemberPhotos", args: { __octopusAuth: token, args: { hashes: [target.photo] } } } });
    expect((await read.json()).data.photos[target.photo!]).toMatch(/^data:image\//);
  });

  test("置き換え: ファイルに無い人を削除(確認つき)。管理者は削除されず、削除した人の写真もサーバーから消える。エラーがあれば何も削除されない", async ({ browser, request }) => {
    const everyone = await adminRpc<Array<{ id: string; name: string; photo?: string }>>(request, "accounts_listMembers", {});
    const doomed = [idOf(39), idOf(40)];
    const doomedPhotos = everyone.filter((m) => doomed.includes(m.id)).map((m) => m.photo!);
    expect(doomedPhotos).toHaveLength(2);
    // 管理者(admin)と、消す2人を CSV から外す。ほかの人は、いまの名簿のまま(= 変更なし)。
    const keep = everyone.filter((m) => m.id !== ADMIN_ID && !doomed.includes(m.id));
    const csv = csvOf(keep.map((m): [string, string, string] => [m.id, m.name, ""]));

    const admin = await newDevice(browser, { signedIn: true });
    const rpc = watchRpc(admin.page);
    await openImportDialog(admin.page);
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csv));
    // 既定は upsert: 削除は出ない
    await expect(admin.page.getByTestId("table-import-counts")).toContainText(`変更なし ${keep.length} / 削除 0 / エラー 0`);
    await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();

    // エラーの行があると、置き換えでも何も削除されない
    await admin.page.getByTestId("table-import-replace").check();
    await expect(admin.page.getByTestId("table-import-counts")).toContainText(`変更なし ${keep.length} / 削除 2 / エラー 0`);
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csv + "csv-e2e-bad,,\r\n"));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("エラー 1");
    await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();

    // 正しいファイルに戻す: 削除の2行が出る(管理者は出ない)
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csv));
    const deleteRows = admin.page.locator('[data-testid="table-import-row"][data-status="delete"]');
    await expect(deleteRows).toHaveCount(2);
    await expect(deleteRows.filter({ hasText: ADMIN_ID })).toHaveCount(0);
    if (evidenceDir) await admin.page.screenshot({ path: `${evidenceDir}/import-replace-preview.png`, fullPage: true });

    // 確認で取り消すと何も起きない
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    const confirm = admin.page.getByRole("dialog").filter({ hasText: "削除の確認" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "キャンセル" }).click();
    expect(rpc.count("accounts_applyRoster")).toBe(0);
    expect(await roster(request)).toHaveLength(COUNT);

    // 確認して確定: 書き込みは1回
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await admin.page.getByRole("dialog").filter({ hasText: "削除の確認" }).getByRole("button", { name: "削除" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText("削除 2", { timeout: 30_000 });
    expect(rpc.count("accounts_applyRoster")).toBe(1);

    const after = await adminRpc<Array<{ id: string }>>(request, "accounts_listMembers", {});
    expect(after.some((m) => doomed.includes(m.id))).toBe(false);
    expect(after.some((m) => m.id === ADMIN_ID)).toBe(true);
    expect((await roster(request)).length).toBe(COUNT - 2);
    // 削除した人の写真はサーバーから消えている
    const exists = await adminRpc<{ existing: string[] }>(request, "accounts_existsMemberPhotos", { hashes: doomedPhotos });
    expect(exists.existing).toEqual([]);
    await admin.context.close();
  });

  test("クイズ管理のメンバー管理: 同じ書き出し・取込がある。置き換えは無い。取り込むと一覧にすぐ載る", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/quiz-admin/members");
    await expect(admin.page.getByTestId("table-export")).toBeVisible();
    await expect(admin.page.getByTestId("table-count")).toContainText("件");
    // ヘルプの案内は、いまの画面名(設定>メンバー)を指す
    await admin.page.getByRole("button", { name: "ヘルプ" }).click();
    await expect(admin.page.getByRole("dialog")).toContainText("「設定」→「メンバー」で発行します");
    await admin.page.getByRole("dialog").getByRole("button", { name: "閉じる" }).last().click();

    const download = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    expect((await download).suggestedFilename()).toBe("members.csv");

    await admin.page.getByTestId("table-import-open").click();
    await expect(admin.page.getByTestId("table-import-replace")).toHaveCount(0);
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvOf([[idOf(1), "クイズ画面で改名", ""], [idOf(99), "クイズ画面で追加", ""]])));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("追加 1 / 更新 1 / 変更なし 0 / エラー 0");
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText("追加 1 / 更新 1 / 変更なし 0 / 削除 0");
    await admin.page.getByTestId("table-import-close").click();
    await expect(admin.page.locator("tbody tr", { hasText: idOf(99) })).toContainText("クイズ画面で追加");
    await expect(admin.page.locator("tbody tr", { hasText: idOf(1) })).toContainText("クイズ画面で改名");
    expect((await roster(request)).find((m) => m.id === idOf(1))?.name).toBe("クイズ画面で改名");
    await adminRpc(request, "accounts_deleteMember", { id: idOf(99) });
    await admin.context.close();
  });
});
