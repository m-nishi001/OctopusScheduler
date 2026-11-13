import { appendFileSync, readFileSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { makeBadgePng } from "../../scripts/seed-content.js";
import { adminRpc, expect, newDevice, openAdvanced, test } from "./fixtures";
import type { Device } from "./fixtures";
import { done, failed, OUT_DIR, scene, shoot } from "./helpers/manual-shots";

/**
 * 利用マニュアル(docs/markdown/manual)の画面写真を撮り直す。docs/assets/images/*.webp に同じ名前で書き出す。
 * 直接でなく `npm run docs:shots` で動かす(ローカルの wrangler を架空データ入りで起動し、このスペックを流して、終わったら止める)。
 *
 * 前提: dev-stack で起動した環境(E2E_SEEDED=1, BASE, E2E_ADMIN_TOKEN)。人物・景品・果物の写真は
 * DOCS_SHOTS_ASSETS のフォルダから読む(person-*.jpg / wiki-*.jpg。無ければ生成した色つきの画像で代用する)。
 * 撮る画像を絞るには DOCS_SHOTS_ONLY='^a-1' のように名前の正規表現を渡す。
 * 公開リポジトリなので、ここに実際のID・パスワード・キーは書かない(全て架空のデータ)。
 */
test.skip(!process.env.E2E_SEEDED, "dev-stack で起動した環境でのみ実行する(npm run docs:shots)");
test.describe.configure({ mode: "serial" });

const ASSETS = process.env.DOCS_SHOTS_ASSETS;
const PEOPLE = [
  ["test-user-01", "佐藤 健一", "person-1043471.jpg"],
  ["test-user-02", "鈴木 美咲", "person-1130626.jpg"],
  ["test-user-03", "高橋 彩", "person-1181690.jpg"],
  ["test-user-04", "田中 太郎", "person-1222271.jpg"],
  ["test-user-05", "伊藤 麻衣", "person-1239291.jpg"],
  ["test-user-06", "渡辺 大輔", "person-1681010.jpg"],
  ["test-user-07", "山本 浩二", ""],
  ["test-user-08", "中村 翔", "person-2182970.jpg"],
  ["test-user-09", "小林 誠", "person-220453.jpg"],
  ["test-user-10", "加藤 結衣", "person-2379004.jpg"],
  ["test-user-11", "吉田 優", "person-415829.jpg"],
  ["test-user-12", "山田 花子", "person-614810.jpg"],
  ["test-user-13", "松本 隆", "person-697509.jpg"],
  ["test-user-14", "井上 愛", "person-733872.jpg"],
  ["test-user-15", "木村 拓也", "person-774909.jpg"],
  ["test-user-16", "林 さくら", "person-91227.jpg"],
] as const;
/** シードの景品(名前)→ 新しい名前と、景品画像・当選画像に使う写真。 */
const PRIZES: Array<{ seed: string; name: string; photo: string; winPhoto: string }> = [
  { seed: "1等 ペア旅行券", name: "1等 ペア旅行券", photo: "wiki-washington-dulles-airport-jet-bridge-1.jpg", winPhoto: "wiki-washington-dulles-airport-jet-bridge-1.jpg" },
  { seed: "2等 最新ワイヤレスイヤホン", name: "2等 薄型テレビ", photo: "wiki-flat-screens-for-sale.jpg", winPhoto: "wiki-flat-screens-for-sale.jpg" },
  { seed: "3等 高級和牛セット", name: "3等 高級和牛セット", photo: "wiki-wagyu-forefillet-flat-iron-2026-02-24.jpg", winPhoto: "wiki-wagyu-forefillet-flat-iron-2026-02-24.jpg" },
  { seed: "4等 ギフトカード 5,000円", name: "4等 ギフトボックス", photo: "wiki-princess-mary-s-gift-box-christmas-1914-10132776506.jpg", winPhoto: "wiki-princess-mary-s-gift-box-christmas-1914-10132776506.jpg" },
  { seed: "5等 人気スイーツ詰め合わせ", name: "5等 炊飯器", photo: "wiki-rice-cooker.jpg", winPhoto: "wiki-rice-cooker.jpg" },
  { seed: "参加賞 オリジナルタンブラー", name: "参加賞 季節の花束", photo: "wiki-bouquet-flowers.jpg", winPhoto: "wiki-bouquet-flowers.jpg" },
];

/** 写真ファイル(無ければ生成した画像)。 */
function photo(file: string, seed = 0) {
  if (ASSETS && file && existsSync(join(ASSETS, file))) return { name: file, mimeType: "image/jpeg", buffer: readFileSync(join(ASSETS, file)) };
  const hue = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2"][seed % 6];
  return { name: `photo-${seed}.png`, mimeType: "image/png", buffer: makeBadgePng(hue, "#1e293b", { width: 400, height: 400 }) };
}

const ADMIN_VIEW = { width: 1280, height: 800 };

async function adminDevice(browser: Parameters<typeof newDevice>[0], height = 800): Promise<Device> {
  const d = await newDevice(browser, { signedIn: true });
  await d.page.setViewportSize({ width: 1280, height });
  return d;
}

/** 管理画面の初回同期(クイズ・景品・画面設定)が済むまで待つ。 */
async function syncAdmin(page: Page) {
  await page.goto("/#/quiz-admin/quizzes");
  await expect(page.getByText("オクトパス豆知識").first()).toBeVisible({ timeout: 60_000 });
  await page.goto("/#/execute/jackpot-admin/prizes");
  await expect(page.getByText("1等 ペア旅行券").first()).toBeVisible({ timeout: 90_000 });
}

const settle = (page: Page, ms = 600) => page.waitForTimeout(ms);

test.afterAll(() => {
  console.log(`\n[docs:shots] 出力先: ${OUT_DIR}`);
  console.log(`[docs:shots] 撮影済み ${done.length} 枚`);
  if (failed.length) console.log(`[docs:shots] 失敗 ${failed.length} 枚:\n` + failed.map((f) => `  - ${f.name}: ${f.reason}`).join("\n"));
});

test("準備: 名簿の名前と顔写真を架空の人物にそろえる", async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = await adminDevice(browser);
  const page = admin.page;
  await page.goto("/#/settings?tab=members");
  await expect(page.getByTestId("table-count")).toHaveText("21件", { timeout: 60_000 });
  for (const [i, [id, name, file]] of PEOPLE.entries()) {
    const row = page.locator("tbody tr", { hasText: id }).first();
    await row.getByRole("button", { name: "編集" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("名前").fill(name);
    if (file) {
      await dialog.getByTestId("member-photo-input").setInputFiles(photo(file, i));
      await expect(dialog.getByTestId("member-photo-preview")).toBeVisible();
    }
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();
  }
  await admin.context.close();
});


/** 開いている編集ダイアログの「名前」を直し、景品画像・当選画像(最初の2つの画像欄)に写真を入れて保存する。 */
async function setPrize(page: Page, p: (typeof PRIZES)[number], index: number) {
  const row = page.locator("tbody tr", { hasText: p.seed }).first();
  await row.getByRole("button", { name: "詳細" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("景品名").fill(p.name);
  const files = dialog.getByTestId("media-file");
  await files.nth(0).setInputFiles(photo(p.photo, index));
  await files.nth(2).setInputFiles(photo(p.winPhoto, index));
  await expect(dialog.getByTestId("media-name").first()).not.toHaveText("未設定");
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).toBeHidden();
}

test("準備: 景品の名前と画像・アセットをそろえる", async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await adminDevice(browser);
  const page = admin.page;
  await syncAdmin(page);
  for (const [i, p] of PRIZES.entries()) await setPrize(page, p, i);
  await expect(page.getByText(PRIZES[5].name).first()).toBeVisible();
  await settle(page, 2000);
  await admin.context.close();
});

test("管理画面(設定・名簿・QR)", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const admin = await adminDevice(browser);
  const page = admin.page;
  const checkboxLabel = (testid: string) => page.locator("label", { has: page.getByTestId(testid) });

  await scene(["a-01-home"], async () => {
    await page.goto("/#/home");
    await expect(page.getByTestId("home-run")).toBeVisible();
    await settle(page);
    await shoot(page, "a-01-home", [page.getByTestId("home-run"), page.getByTestId("home-quiz"), page.getByTestId("home-jackpot"), page.getByTestId("home-settings")]);
  });

  await scene(["a-04-settings-members", "a-42-roster-member-edit", "a-43-roster-import-preview"], async () => {
    await page.goto("/#/settings?tab=members");
    await expect(page.getByTestId("member-thumb").first()).toBeVisible({ timeout: 30_000 });
    await settle(page, 1500);
    const first = page.locator("tbody tr").first();
    await shoot(page, "a-04-settings-members", [
      page.getByTestId("member-add"),
      page.getByTestId("table-export"),
      checkboxLabel("table-export-media"),
      page.getByTestId("table-import-open"),
      page.getByTestId("member-issue-missing"),
      first.getByTestId("member-thumb"),
      [first.locator("td").nth(4), first.locator("td").nth(6)],
      first.getByRole("button", { name: "編集" }),
    ]);

    // 名簿のメンバー編集ダイアログ
    await first.getByRole("button", { name: "編集" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("member-photo-preview")).toBeVisible();
    await shoot(page, "a-42-roster-member-edit", [
      dialog.getByLabel("ID").first(),
      dialog.getByLabel("名前"),
      dialog.getByTestId("member-photo-input"),
      dialog.getByTestId("member-photo-clear"),
      dialog.getByText("管理者にする"),
      dialog.getByTestId("member-password"),
      dialog.getByRole("button", { name: "保存" }),
    ]);
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(dialog).toBeHidden();

    // CSV取込のプレビュー: 書き出したCSVの一部に、名前の変更・追加・エラー(名前が空)の行を足す
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("table-export").click()]);
    const lines = readFileSync(await download.path(), "utf-8").replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
    const body = lines.slice(1, 7);
    const cols = lines[0].split(",");
    const nameCol = cols.indexOf("名前");
    const renamed = body[5].split(",");
    renamed[nameCol] = "渡辺 大輔(営業部)";
    const blank = (id: string, name: string) => cols.map((c) => (c === "ID" ? id : c === "名前" ? name : "")).join(",");
    const edited = [lines[0], ...body.slice(0, 5), renamed.join(","), blank("kai-new-01", "青木 蓮"), blank("kai-new-02", "")].join("\r\n") + "\r\n";
    await page.getByTestId("table-import-open").click();
    await page.getByTestId("table-import-table").setInputFiles({ name: "members.csv", mimeType: "text/csv", buffer: Buffer.from(edited, "utf-8") });
    await expect(page.getByTestId("table-import-counts")).toBeVisible({ timeout: 30_000 });
    const imp = page.getByRole("dialog");
    await settle(page);
    await shoot(page, "a-43-roster-import-preview", [
      imp.getByTestId("table-import-table"),
      imp.getByTestId("table-import-media"),
      imp.getByTestId("table-import-counts"),
      imp.getByRole("button", { name: "取り込む" }),
    ]);
    await page.keyboard.press("Escape");
    await page.reload();
  });

  // 未発行の参加者(名簿に足しただけで、受付QRはまだ)がいる状態 → QRシート
  await scene(["a-08-accounts-unissued", "a-09-qr-sheet"], async () => {
    const tmp = ["kai-new-a", "kai-new-b"];
    try {
      await adminRpc(request, "accounts_addMember", { id: tmp[0], name: "青木 蓮" });
      await adminRpc(request, "accounts_addMember", { id: tmp[1], name: "石井 楓" });
      await page.goto("/#/home");
      await page.goto("/#/settings?tab=members");
      const issue = page.getByTestId("member-issue-missing");
      await expect(issue).toContainText("(2人)", { timeout: 30_000 });
      await settle(page, 1500);
      await shoot(page, "a-08-accounts-unissued", [issue]);
      await issue.click();
      const sheet = page.getByTestId("login-qr-sheet");
      await expect(sheet).toBeVisible({ timeout: 30_000 });
      // 本物のログインキーを写さないよう、QRは見本の別のQRに差し替えて撮る
      await page.evaluate(async () => {
        for (const img of Array.from(document.querySelectorAll<HTMLImageElement>(".login-qr-sheet__qr"))) img.src = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="29" height="29" fill="#fff"/>${Array.from({ length: 29 * 29 }, (_, i) => { const x = i % 29, y = Math.floor(i / 29); const finder = (x < 8 && y < 8) || (x > 20 && y < 8) || (x < 8 && y > 20); const on = finder ? x % 7 === 0 || y % 7 === 0 || x % 7 === 6 || y % 7 === 6 || ((x % 7) > 1 && (x % 7) < 5 && (y % 7) > 1 && (y % 7) < 5) : (x * 7 + y * 13 + x * y) % 5 < 2; return on ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ""; }).join("")}</svg>`);
      });
      await settle(page, 400);
      await shoot(page, "a-09-qr-sheet", [sheet.locator("figure").first()]);
    } finally {
      for (const id of tmp) await adminRpc(request, "accounts_deleteMember", { id }).catch(() => undefined);
    }
  });

  await scene(["a-05-settings-assets", "a-06-settings-events"], async () => {
    await page.goto("/#/settings?tab=assets");
    await settle(page, 2500);
    await shoot(page, "a-05-settings-assets", [page.getByRole("button", { name: "追加", exact: true })]);
    await page.goto("/#/settings?tab=events");
    await settle(page);
    await shoot(page, "a-06-settings-events", [page.getByRole("button", { name: "追加", exact: true }), page.getByRole("button", { name: "実行画面を開く" })]);
  });
  await admin.context.close();
});

test("ジャックポット管理(メンバー・景品・結果)", async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = await adminDevice(browser);
  const page = admin.page;
  const toolbar = (n: string) => page.getByTestId(n);
  page.on("dialog", (d) => void d.accept());

  await scene(["a-10-jp-members", "a-11-jp-member-edit", "a-12-jp-member-import"], async () => {
    await page.goto("/#/execute/jackpot-admin/members");
    await expect(page.getByText(PEOPLE[0][1]).first()).toBeVisible({ timeout: 60_000 });
    await settle(page, 1500);
    const row = page.locator("tbody tr").first();
    await shoot(page, "a-10-jp-members", [page.getByRole("button", { name: "追加", exact: true }), toolbar("table-export"), toolbar("table-import-open"), row.getByRole("button", { name: "詳細" })]);
    await row.getByRole("button", { name: "詳細" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await settle(page);
    await shoot(page, "a-11-jp-member-edit", [dialog.locator("input").nth(1), dialog.locator("p, small").first(), dialog.getByRole("button", { name: "保存" })]);
    await dialog.getByRole("button", { name: /キャンセル|閉じる/ }).first().click();
    await expect(dialog).toBeHidden();
    await toolbar("table-import-open").click();
    const imp = page.getByRole("dialog");
    await expect(imp).toBeVisible();
    await settle(page);
    await shoot(page, "a-12-jp-member-import", [imp.locator("p").first(), imp.getByTestId("table-import-table"), imp.getByRole("button", { name: "取り込む" })]);
    await page.keyboard.press("Escape");
  });

  await scene(["a-13-jp-prizes", "a-14-jp-prize-edit", "a-15-jp-media-picker"], async () => {
    await page.goto("/#/execute/jackpot-admin/prizes");
    await expect(page.getByText(PRIZES[0].name).first()).toBeVisible({ timeout: 60_000 });
    await settle(page, 2000);
    const row = page.locator("tbody tr").first();
    await shoot(page, "a-13-jp-prizes", [page.getByRole("button", { name: "追加", exact: true }), toolbar("table-import-open"), row.getByRole("button", { name: "詳細" })]);
    await row.getByRole("button", { name: "詳細" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("media-name").first()).toBeVisible();
    await settle(page, 1200);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await settle(page);
    const pickers = dialog.getByTestId("media-picker");
    await shoot(page, "a-14-jp-prize-edit", [dialog.getByPlaceholder("景品名"), dialog.locator("select").first(), pickers.nth(0), pickers.nth(2)]);
    await page.setViewportSize(ADMIN_VIEW);
    await settle(page);
    // 素材選択の拡大: 「抽選画像」の欄(ファイルを選ぶ / 登録済みから選ぶ / プレビュー / 外す)
    const picker = pickers.nth(0);
    await picker.scrollIntoViewIfNeeded();
    await settle(page);
    await shoot(page, "a-15-jp-media-picker", [picker.getByTestId("media-file"), picker.getByTestId("media-select"), picker.locator("img").first(), picker.getByTestId("media-remove")]);
    await dialog.getByRole("button", { name: "キャンセル" }).click();
  });

  await scene(["a-16-jp-results"], async () => {
    await page.goto("/#/execute/jackpot-admin/results");
    await expect(page.getByTestId("total-draws")).toBeVisible();
    await settle(page);
    await shoot(page, "a-16-jp-results", [page.getByRole("button", { name: "結果をリセット" })]);
  });

  await scene(["a-17-jp-screen-opening", "a-18-jp-screen-description", "a-19-jp-screen-demo", "a-20-jp-screen-draw", "a-21-jp-screen-result", "a-22-jp-screen-ending"], async () => {
    const save = page.getByRole("button", { name: "保存" });
    const add = page.getByRole("button", { name: "追加", exact: true });
    const go = async (tab: string) => {
      await page.goto(`/#/execute/jackpot-admin/screens/${tab}`);
      await expect(save.first()).toBeVisible({ timeout: 30_000 });
      await settle(page, 1500);
    };
    const pickers = () => page.getByTestId("media-picker");
    await go("opening");
    await shoot(page, "a-17-jp-screen-opening", [pickers().first(), add, page.getByRole("button", { name: "詳細" }).first(), save]);
    await go("description");
    await shoot(page, "a-18-jp-screen-description", [add, save]);
    await go("demo");
    await shoot(page, "a-19-jp-screen-demo", [pickers().first(), save]);
    await go("result");
    await shoot(page, "a-21-jp-screen-result", [pickers().first()]);
    await go("ending");
    await shoot(page, "a-22-jp-screen-ending", [add]).catch(() => undefined);

    // 画面設定のCSV: 書き出したCSVの1行を変え、同じ項目の重複行(エラー)を足して、取込のプレビューを出す
    await go("opening");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("table-export").click()]);
    const lines = readFileSync(await download.path(), "utf-8").replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
    const cols = lines[0].split(",");
    const textCol = cols.indexOf("文字");
    const textRowIndex = lines.findIndex((l, i) => i > 0 && l.split(",")[textCol]);
    const changed = lines[textRowIndex].split(",");
    changed[textCol] = "本日はご参加ありがとうございます";
    const edited = [...lines.slice(0, textRowIndex), changed.join(","), ...lines.slice(textRowIndex + 1), lines[1]].join("\r\n") + "\r\n";
    await page.getByTestId("table-import-open").click();
    await page.getByTestId("table-import-table").setInputFiles({ name: "screens.csv", mimeType: "text/csv", buffer: Buffer.from(edited, "utf-8") });
    await expect(page.getByTestId("table-import-counts")).toBeVisible({ timeout: 30_000 });
    await settle(page);
    const imp = page.getByRole("dialog");
    const errorRow = imp.locator('[data-testid="table-import-row"][data-status="error"]').first();
    await errorRow.scrollIntoViewIfNeeded();
    await settle(page, 300);
    await shoot(page, "a-23-jp-screen-import", [imp.getByTestId("table-import-table"), imp.getByTestId("table-import-counts"), errorRow, imp.getByRole("button", { name: "取り込む" })]);
    await imp.getByRole("button", { name: "キャンセル" }).click();
    await expect(imp).toBeHidden();

    await go("draw");
    await shoot(page, "a-20-jp-screen-draw", [pickers().first(), page.getByTestId("prize-stop-sec"), page.getByTestId("participant-stop-checkbox"), page.getByTestId("kakuhen-mode"), page.getByRole("button", { name: "テスト", exact: true })]);
  });

  await admin.context.close();
});

/** 果物クイズ(写真つき)の選択肢。 */
const FRUITS = [
  { text: "りんご", color: "赤", photo: "wiki-beautiful-red-apple-01.jpg" },
  { text: "オレンジ", color: "黄", photo: "wiki-orange-fruit-unsplash.jpg" },
  { text: "ぶどう", color: "紫", photo: "wiki-a-bunch-of-grapes-on-a-vine.jpg" },
] as const;
export const QUIZ_TITLE = "くだものクイズ(写真つき)";

test("クイズ管理(一覧・追加・取込)", async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = await adminDevice(browser, 1000);
  const page = admin.page;
  page.on("dialog", (d) => void d.accept());
  const addBtn = page.getByRole("button", { name: "追加", exact: true });
  const dialogs = page.getByRole("dialog");

  await scene(["a-30-quiz-list"], async () => {
    await page.goto("/#/quiz-admin/quizzes");
    await expect(page.getByText("オクトパス豆知識").first()).toBeVisible({ timeout: 60_000 });
    await settle(page, 1200);
    const row = page.locator("tbody tr").first();
    await shoot(page, "a-30-quiz-list", [addBtn, row.getByRole("button", { name: "編集" }), row.getByRole("button", { name: "プレビュー" }), row.getByRole("button", { name: "削除" })]);
  });

  await scene(["a-31-quiz-edit-top", "a-32-quiz-option", "a-33-quiz-edit-bottom", "a-34-quiz-list-added"], async () => {
    await page.goto("/#/quiz-admin/quizzes");
    await expect(page.getByText("オクトパス豆知識").first()).toBeVisible({ timeout: 60_000 });
    await addBtn.click();
    const dialog = dialogs.first();
    await dialog.locator("input[type=text]").first().fill(QUIZ_TITLE);
    await dialog.locator("input[type=number]").first().fill("30");
    await dialog.locator("textarea").fill("オレンジはどれでしょう?");
    await settle(page);
    await shoot(page, "a-31-quiz-edit-top", [dialog.locator("input[type=text]").first(), dialog.locator("input[type=number]").first(), dialog.locator("textarea"), dialog.locator("select").first()]);

    for (const [i, f] of FRUITS.entries()) {
      await dialog.getByRole("button", { name: "選択肢を追加" }).click();
      const opt = dialogs.last();
      await opt.locator("input[type=text]").first().fill(f.text);
      await opt.locator("input[type=file]").setInputFiles(photo(f.photo, i));
      await opt.getByText(f.color, { exact: true }).click();
      await settle(page, 500);
      if (i === 0) await shoot(page, "a-32-quiz-option", [opt.locator("input[type=text]").first(), opt.locator("input[type=file]"), [opt.getByText("赤", { exact: true }), opt.getByText("紫", { exact: true })], opt.getByRole("button", { name: "保存" })]);
      await opt.getByRole("button", { name: "保存" }).click();
      await expect(dialogs).toHaveCount(1);
    }
    await dialog.locator("select").first().selectOption({ label: /オレンジ/ as never }).catch(async () => dialog.locator("select").first().selectOption("2"));
    await dialog.getByText("当選景品名").locator("..").locator("input").fill("フルーツ詰め合わせ");
    await dialog.getByRole("button", { name: "選択肢を追加" }).scrollIntoViewIfNeeded();
    await dialog.locator("form, div").last().evaluate((el) => el.scrollIntoView?.());
    await settle(page);
    await shoot(page, "a-33-quiz-edit-bottom", [dialog.getByText("当選景品名").locator("..").locator("input"), dialog.getByRole("button", { name: "選択肢を追加" }), dialog.getByRole("button", { name: "保存" })]);
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialogs).toHaveCount(0);
    await expect(page.getByText(QUIZ_TITLE).first()).toBeVisible();
    await settle(page, 1200);
    await shoot(page, "a-34-quiz-list-added", [page.locator("tbody tr", { hasText: QUIZ_TITLE })]);
  });

  await scene(["a-35-quiz-members"], async () => {
    await page.goto("/#/quiz-admin/members");
    await settle(page, 1500);
    await shoot(page, "a-35-quiz-members", [addBtn]);
  });

  await scene(["a-36-quiz-import-preview"], async () => {
    await page.goto("/#/quiz-admin/quizzes");
    await expect(page.getByText(QUIZ_TITLE).first()).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("table-export").click()]);
    const lines = readFileSync(await download.path(), "utf-8").replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
    const cols = lines[0].split(",");
    const titleCol = cols.indexOf("タイトル");
    const noCol = cols.indexOf("正解(選択肢の番号)");
    const changed = lines[2].split(",");
    changed[titleCol] = "暦のクイズ(改訂版)";
    const broken = lines[1].split(",");
    broken[0] = "csv-new-01";
    broken[noCol] = "9";
    const edited = [lines[0], lines[1], changed.join(","), ...lines.slice(3), broken.join(",")].join("\r\n") + "\r\n";
    await page.getByTestId("table-import-open").click();
    await page.getByTestId("table-import-table").setInputFiles({ name: "quizzes.csv", mimeType: "text/csv", buffer: Buffer.from(edited, "utf-8") });
    await expect(page.getByTestId("table-import-counts")).toBeVisible({ timeout: 30_000 });
    await settle(page);
    const imp = page.getByRole("dialog");
    const errorRow = imp.locator('[data-testid="table-import-row"][data-status="error"]').first();
    await errorRow.scrollIntoViewIfNeeded();
    await settle(page, 300);
    await shoot(page, "a-36-quiz-import-preview", [imp.getByTestId("table-import-table"), imp.getByTestId("table-import-counts"), errorRow, imp.getByRole("button", { name: "取り込む" })]);
    await page.keyboard.press("Escape");
  });
  await admin.context.close();
});

test("同期の表示(エラーと詳細)", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const DRAW_PAGE = "/#/execute/jackpot-admin/screens/draw";
  const a = await adminDevice(browser);
  const b = await adminDevice(browser);
  const page = a.page;
  const sec = (p: Page) => p.getByTestId("prize-stop-sec");
  const save = async (p: Page, v: number) => {
    await sec(p).fill(String(v));
    await p.getByRole("button", { name: "保存" }).click();
    await expect(p.getByText("保存しました")).toBeVisible();
  };
  const serverSec = async () => {
    const res = await adminRpc<{ json: string | null }>(request, "jackpotGame_getRecord", {});
    const m = res.json?.match(/prizeStopSec[^0-9]*(\d+)/);
    return m ? Number(m[1]) : null;
  };
  try {
    await scene(["a-40-sync-detail", "a-41-sync-error"], async () => {
      await syncAdmin(b.page); // 初回の同期より前に保存すると、空のデータで上書きしてしまうので、先に取り込んでおく
      await page.clock.install();
      await syncAdmin(page);
      await page.goto(DRAW_PAGE);
      await expect(sec(page)).toBeVisible({ timeout: 30_000 });
      const original = Number(await sec(page).inputValue());
      const changed = original === 9 ? 8 : 9;
      // 別の端末が値を変え、こちらが同期で取り込む(「他の端末の変更を反映」の記録)
      await b.page.goto(DRAW_PAGE);
      await expect(sec(b.page)).toBeVisible();
      await save(b.page, changed);
      await expect.poll(serverSec, { timeout: 20_000 }).toBe(changed);
      await page.clock.fastForward(61_000);
      await expect(sec(page)).toHaveValue(String(changed));
      // サーバーへの送信が失敗する状態にして保存する(「送信に失敗」の記録と、ヘッダーの同期エラー)
      const failing = async (route: import("@playwright/test").Route) => {
        if ((route.request().postData() ?? "").includes("jackpotGame_saveRecord")) {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ status: "error", message: "サーバー内部のエラー", retryable: false }) });
          return;
        }
        await route.continue();
      };
      await page.route("**/rpc", failing);
      await save(page, original);
      const indicator = page.getByTestId("sync-status");
      await expect(indicator).toContainText("同期エラー", { timeout: 20_000 });
      await settle(page);
      await shoot(page, "a-41-sync-error", [indicator]);
      await indicator.click();
      const log = page.getByTestId("sync-log");
      const reflected = log.getByRole("row").filter({ hasText: "画面設定" }).filter({ hasText: "他の端末の変更を反映" }).first();
      const failed = log.getByRole("row").filter({ hasText: "画面設定" }).filter({ hasText: "送信に失敗" }).first();
      await expect(failed).toBeVisible();
      await settle(page);
      await shoot(page, "a-40-sync-detail", [reflected, failed]);
      await page.keyboard.press("Escape");
      // 元に戻す
      await page.unroute("**/rpc", failing);
      await save(page, original);
      await expect(indicator).toContainText("同期済み", { timeout: 30_000 });
      await expect.poll(serverSec, { timeout: 20_000 }).toBe(original);
    });
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

// ───────────────────────── 当日の操作(会場・手元・参加者) ─────────────────────────

const SESSION_NAME = "忘年会 ジャックポット抽選会";
const PHONE_VIEW = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } as const;
const HOST_VIEW = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } as const;

/** 管理者のトークンでログイン済みの端末(スマホ幅 = 手元の操作画面、会場 = 1280x720)。 */
async function liveDevice(browser: Parameters<typeof newDevice>[0], kind: "phone" | "host" | "desk", signedIn = true): Promise<Device> {
  const options = kind === "phone" ? PHONE_VIEW : kind === "host" ? HOST_VIEW : { viewport: ADMIN_VIEW };
  const context = await browser.newContext(options);
  if (signedIn) {
    await context.addInitScript((token) => {
      try {
        if (!localStorage.getItem("octopus-session-token")) localStorage.setItem("octopus-session-token", token);
      } catch {
        // 保存できない環境では未ログインのまま進む
      }
    }, process.env.E2E_ADMIN_TOKEN ?? "");
  }
  const page = await context.newPage();
  page.on("dialog", (d) => void d.dismiss());
  return { context, page };
}

const nextBtn = (page: Page) => page.getByTestId("next-button");
const hostRoute = (page: Page) => page.evaluate(() => location.hash.replace(/^#/, ""));

/** 参加者の最初のスマホ(ログイン前)。 */
const loginPhone = async (browser: Parameters<typeof newDevice>[0]) => liveDevice(browser, "phone", false);

/** 手元コンソールの主ボタンの文言が出るまで待ち、押す(会場・参加者の反映を待つため、押したあとに少し置く)。 */
async function pressNext(admin: Page, label: RegExp | string, after = 800): Promise<void> {
  await expect(nextBtn(admin)).toContainText(label, { timeout: 30_000 });
  await nextBtn(admin).click();
  await admin.waitForTimeout(after);
}

/** クイズを1問、最後の順位発表まで進める。撮影するときは shots を渡す。 */
async function playQuiz(opts: {
  admin: Page;
  host: Page;
  phones: Device[];
  title: string;
  answers: number[]; // phones の先頭から。選択肢の番号(0始まり)。範囲外なら答えない
  shots?: boolean;
}): Promise<void> {
  const { admin, host, phones, title, answers, shots } = opts;
  await admin.getByTestId("quiz-select").selectOption({ label: title });
  await admin.getByTestId("start-quiz").click();
  await expect.poll(() => hostRoute(host)).toMatch(/\/intro$/);
  await settle(admin, 2500);
  if (shots) {
    await shoot(admin, "d-12-console-quiz-intro", [nextBtn(admin), admin.getByTestId("status-card")]);
    await shoot(host, "s-10-quiz-intro");
  }
  await pressNext(admin, "次へ"); // → エントリー
  await expect.poll(() => hostRoute(host)).toMatch(/\/entry$/);
  await pressNext(admin, "次へ", 1500); // → 出題
  await expect.poll(() => hostRoute(host)).toMatch(/\/play$/);
  await settle(admin, 1500);
  if (shots) await shoot(phones[0].page, "p-05-quiz-play", [phones[0].page.getByTestId("quiz-panel").locator("h2, h3, p").first(), phones[0].page.getByTestId("quiz-panel").getByRole("button").nth(1)]);
  for (const [i, no] of answers.entries()) {
    const buttons = phones[i].page.getByTestId("quiz-panel").getByRole("button");
    if (no < (await buttons.count())) {
      await buttons.nth(no).click();
      await expect(phones[i].page.getByTestId("quiz-answered")).toBeVisible();
    }
  }
  await expect(admin.getByTestId("quiz-state")).toContainText(`回答 ${answers.filter((n) => n >= 0).length} 人`, { timeout: 30_000 });
  await settle(admin, 800);
  if (shots) {
    await shoot(host, "s-12-quiz-play");
    await shoot(admin, "d-13-console-quiz-play", [nextBtn(admin), admin.getByTestId("quiz-state")]);
    await shoot(phones[0].page, "p-06-quiz-answered", [phones[0].page.getByTestId("quiz-answered")]);
  }
  await pressNext(admin, "受付を締め切る", 1500);
  if (shots) await shoot(phones[5].page, "p-07-quiz-closed");
  await pressNext(admin, "次へ", 1500); // → 正解発表
  await expect.poll(() => hostRoute(host)).toMatch(/\/answer$/);
  await settle(admin, 2500);
  if (shots) {
    await shoot(host, "s-13-quiz-answer");
    await shoot(phones[0].page, "p-08-quiz-verdict", [phones[0].page.getByTestId("quiz-verdict")]);
  }
  await pressNext(admin, "次へ", 1500); // → 結果発表
  await expect.poll(() => hostRoute(host)).toMatch(/\/result$/);
  await settle(admin, 6000); // 順位が下から1つずつ出る
  if (shots) await shoot(host, "s-15-quiz-result-2");
  // 発表が終わるまで進める(主ボタンが「次へ」のままでも、ホストが結果以外に移るまでは押さない)
  await settle(admin, 3000);
}

/** ジャックポットを1回引く(メンバー抽選 → 景品抽選)。shots があれば撮る。当選者の名前を返す。 */
async function drawJackpot(opts: { admin: Page; host: Page; phones: Device[]; shots?: boolean }): Promise<string> {
  const { admin, host, phones, shots } = opts;
  await pressNext(admin, "次へ", 1200); // 開始前 → メンバー抽選を回す
  if (shots) {
    await shoot(admin, "d-21-console-draw", [nextBtn(admin)]);
  }
  await expect(nextBtn(admin)).toContainText("止める", { timeout: 30_000 });
  await settle(admin, 1500);
  if (shots) await shoot(admin, "d-22-console-stop", [nextBtn(admin)]);
  await pressNext(admin, "止める", 3000); // → 当選者
  const state = await admin.getByTestId("jackpot-state").innerText();
  const winner = /当選者: (\S+(?: \S+)?)/.exec(state)?.[1] ?? "";
  await settle(admin, 2500);
  if (shots) {
    await shoot(host, "s-25-jp-winner");
    for (const p of phones) {
      if (await p.page.getByTestId("you-won").isVisible().catch(() => false)) {
        await shoot(p.page, "p-13-win-overlay");
        break;
      }
    }
  }
  await pressNext(admin, "次へ", 2500); // → 景品抽選の待機
  await expect(nextBtn(admin)).toContainText("次へ", { timeout: 30_000 });
  await pressNext(admin, "次へ", 1500); // → 景品が回る
  await expect(nextBtn(admin)).toContainText("止める", { timeout: 30_000 });
  await settle(admin, 800);
  if (shots) await shoot(host, "s-26-jp-prize-draw");
  await pressNext(admin, "止める", 500);
  await expect(host.getByTestId("prize-winning-dialog")).toBeVisible({ timeout: 60_000 });
  await settle(admin, 3500);
  if (shots) await shoot(host, "s-27-jp-prize-result");
  await expect(nextBtn(admin)).toContainText("次へ", { timeout: 60_000 });
  await pressNext(admin, "次へ", 1500);
  return winner;
}

test("当日の操作(会場・手元・参加者)", async ({ browser, request }) => {
  test.setTimeout(1_200_000);
  const sessions = await adminRpc<Array<{ id: string; status: string }>>(request, "sessionHub_listSessions", undefined);
  for (const s of sessions) if (s.status !== "closed") await adminRpc(request, "sessionHub_closeSession", { sessionId: s.id }).catch(() => undefined);

  // セッションを作って、ポータルに公開する
  const desk = await liveDevice(browser, "desk");
  await syncAdmin(desk.page);
  await desk.page.goto("/#/sessions");
  await desk.page.getByPlaceholder("例: 夏祭りイベント").fill(SESSION_NAME);
  await desk.page.getByRole("button", { name: "セッションを作成" }).click();
  const row = desk.page.locator("tbody tr", { hasText: SESSION_NAME }).filter({ hasText: "待機中" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "操作する" }).click();
  await desk.page.waitForURL(/#\/session\/console\/[^/]+$/);
  const sessionId = new URL(desk.page.url()).hash.split("/").pop()!;
  await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });

  const host = await liveDevice(browser, "host");
  await syncAdmin(host.page);
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  const admin = await liveDevice(browser, "phone");
  await syncAdmin(admin.page);
  await admin.page.goto(`/#/session/console/${sessionId}`);
  await expect(admin.page.getByTestId("status-card")).toBeVisible();

  // d-01: セッション一覧
  await scene(["d-01-sessions"], async () => {
    await desk.page.goto("/#/sessions");
    const r = desk.page.locator("tbody tr", { hasText: SESSION_NAME }).first();
    await expect(r.getByRole("button", { name: "ポータル公開を止める" })).toBeVisible({ timeout: 30_000 });
    await settle(desk.page, 800);
    await shoot(desk.page, "d-01-sessions", [
      desk.page.getByTestId("quick-start"),
      desk.page.getByPlaceholder("例: 夏祭りイベント"),
      desk.page.getByLabel("デモ(リハーサル)として作る"),
      r.getByRole("button", { name: "ホストとして開く" }),
      r.getByRole("button", { name: "操作する" }),
      r.getByRole("button", { name: "ポータル公開を止める" }),
      r.getByRole("button", { name: "終了" }),
    ]);
  });

  // p-01: 参加者のログイン画面
  const loginScreen = await loginPhone(browser);
  await scene(["p-01-login"], async () => {
    await loginScreen.page.goto("/#/login");
    const inputs = loginScreen.page.locator("input");
    await expect(inputs.first()).toBeVisible({ timeout: 30_000 });
    await settle(loginScreen.page, 800);
    await shoot(loginScreen.page, "p-01-login", [inputs.nth(0), inputs.nth(1), loginScreen.page.locator("button[type=submit]").first()]);
  });
  await loginScreen.context.close();

  // 参加者6人(受付のQRでログインした想定)
  const phones: Device[] = [];
  for (const [id] of PEOPLE.slice(0, 6)) {
    const { key } = await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id });
    const d = await loginPhone(browser);
    await d.page.goto(`/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`);
    await expect(d.page.getByTestId("portal-conn")).toContainText("接続中", { timeout: 30_000 });
    phones.push(d);
  }
  await expect(admin.page.getByTestId("status-card")).toContainText("参加者 6 人", { timeout: 30_000 });
  await settle(admin.page, 1500);

  await scene(["s-01-host-lobby"], async () => {
    await expect(host.page.getByTestId("host-count")).toContainText("6");
    await shoot(host.page, "s-01-host-lobby", [host.page.locator(".host-view__title"), host.page.getByTestId("host-count")]);
  });
  await scene(["p-02-home"], async () => {
    const p = phones[0].page;
    await shoot(p, "p-02-home", [p.getByTestId("home-greeting"), p.getByTestId("portal-conn"), p.locator(".pp-tabs")]);
  });
  await scene(["d-10-console-start"], async () => {
    await shoot(admin.page, "d-10-console-start", [admin.page.getByTestId("status-card"), admin.page.getByTestId("quiz-select"), admin.page.getByTestId("start-quiz"), admin.page.getByTestId("start-jackpot"), admin.page.getByTestId("start-entry")]);
  });

  // エントリー受付
  await scene(["d-11-console-entry", "p-03-entry-card", "p-04-entry-done", "s-02-event-entry"], async () => {
    await admin.page.getByTestId("start-entry").click();
    await expect(phones[0].page.getByTestId("entry-button")).toBeVisible({ timeout: 30_000 });
    await shoot(phones[0].page, "p-03-entry-card", [phones[0].page.getByTestId("entry-button")]);
    for (const p of phones) {
      await p.page.getByTestId("entry-button").click();
      await expect(p.page.getByTestId("entry-done")).toBeVisible();
    }
    await shoot(phones[0].page, "p-04-entry-done", [phones[0].page.getByTestId("entry-done")]);
    await expect(admin.page.getByTestId("entry-count")).toHaveText("6", { timeout: 30_000 });
    await settle(admin.page, 3000);
    await shoot(host.page, "s-02-event-entry");
    await shoot(admin.page, "d-11-console-entry", [admin.page.getByTestId("entry-panel").getByRole("button", { name: "エントリーを締め切る" })]);
  });

  // クイズ(1問目を撮影し、2問目は結果タブを厚くするためだけに進める)
  await scene(["d-12-console-quiz-intro", "s-10-quiz-intro", "s-12-quiz-play", "d-13-console-quiz-play", "p-05-quiz-play", "p-06-quiz-answered", "p-07-quiz-closed", "p-08-quiz-verdict", "s-13-quiz-answer", "s-15-quiz-result-2"], async () => {
    await playQuiz({ admin: admin.page, host: host.page, phones, title: QUIZ_TITLE, answers: [1, 1, 0, 1, 2], shots: true });
    await admin.page.reload();
    await expect(admin.page.getByTestId("status-card")).toBeVisible();
    await playQuiz({ admin: admin.page, host: host.page, phones, title: "オクトパス豆知識", answers: [2, 2, 0, 2, 1, 2] });
  });

  // ジャックポット
  await scene(["s-20-jp-opening", "s-22-jp-description", "s-23-jp-draw-ready", "d-21-console-draw", "d-22-console-stop", "s-25-jp-winner", "p-13-win-overlay", "s-26-jp-prize-draw", "s-27-jp-prize-result"], async () => {
    await admin.page.reload();
    await expect(admin.page.getByTestId("start-jackpot")).toBeVisible({ timeout: 30_000 });
    await admin.page.getByTestId("start-jackpot").click();
    await expect.poll(() => hostRoute(host.page)).toBe("/execute/jackpot-opening");
    await settle(admin.page, 4000);
    await shoot(host.page, "s-20-jp-opening");
    await pressNext(admin.page, "エントリーへ", 1500);
    await pressNext(admin.page, "説明へ", 3000);
    await shoot(host.page, "s-22-jp-description");
    for (let i = 0; i < 3; i++) await pressNext(admin.page, "次のスライドへ", 1500);
    await pressNext(admin.page, "抽選を始める", 3000);
    await expect.poll(() => hostRoute(host.page)).toBe("/execute/jackpot-draw");
    await shoot(host.page, "s-23-jp-draw-ready");
    await drawJackpot({ admin: admin.page, host: host.page, phones, shots: true });
    await drawJackpot({ admin: admin.page, host: host.page, phones });
  });

  // 結果・エンディング(ホスト)、詳細な操作(手元)
  await scene(["s-30-jp-result", "s-31-jp-ending", "d-15-console-advanced"], async () => {
    await openAdvanced(admin.page);
    await admin.page.getByTestId("advanced").scrollIntoViewIfNeeded();
    await admin.page.getByTestId("advanced").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await settle(admin.page, 600);
    await shoot(admin.page, "d-15-console-advanced", [admin.page.getByTestId("advanced").locator("summary")]);
    await admin.page.getByTestId("advanced").getByRole("button", { name: "ジャックポット: 結果" }).click();
    await expect.poll(() => hostRoute(host.page)).toBe("/execute/jackpot-result");
    await settle(admin.page, 5000);
    await shoot(host.page, "s-30-jp-result");
    await admin.page.getByTestId("advanced").getByRole("button", { name: "ジャックポット: エンディング" }).click();
    await expect.poll(() => hostRoute(host.page)).toBe("/execute/jackpot-ending");
    await settle(admin.page, 5000);
    await shoot(host.page, "s-31-jp-ending");
  });

  // 参加者の結果・マイページ
  await scene(["p-10-results-quiz", "p-11-results-jackpot", "p-12-mypage"], async () => {
    const p = phones[0].page;
    await p.locator(".pp-tabs").getByRole("link", { name: "結果" }).click();
    await expect(p.getByTestId("results-round").first()).toBeVisible({ timeout: 60_000 });
    await settle(p, 1000);
    await shoot(p, "p-10-results-quiz", [p.getByTestId("results-round").first().locator("> *").first(), p.getByTestId("results-tab-jackpot")]);
    await p.getByTestId("results-tab-jackpot").click();
    await expect(p.getByTestId("results-draw").first()).toBeVisible({ timeout: 30_000 });
    await settle(p, 800);
    await shoot(p, "p-11-results-jackpot", [p.getByTestId("results-draw").first()]);
    await p.locator(".pp-tabs").getByRole("link", { name: "マイページ" }).click();
    await expect(p.getByTestId("me-signout")).toBeVisible();
    await settle(p, 800);
    await shoot(p, "p-12-mypage", [p.getByTestId("me-signout")]);
  });

  for (const d of [desk, host, admin, ...phones]) await d.context.close();
  await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
});

test("デモ(リハーサル)の画面", async ({ browser }) => {
  test.setTimeout(240_000);
  const desk = await liveDevice(browser, "host"); // 会場の画面と同じ 1280x720
  const page = desk.page;
  await scene(["x-01-demo-button", "x-02-demo-screen"], async () => {
    await syncAdmin(page);
    await page.setViewportSize(ADMIN_VIEW);
    await page.goto("/#/execute/jackpot-admin/members");
    await expect(page.getByText(PEOPLE[0][1]).first()).toBeVisible({ timeout: 30_000 });
    await settle(page, 1500);
    await shoot(page, "x-01-demo-button", [page.getByRole("button", { name: "デモ実行" })]);
    await page.setViewportSize(HOST_VIEW.viewport);
    await page.getByRole("button", { name: "デモ実行" }).click();
    await expect(page.locator("body")).toContainText(/.+/);
    await settle(page, 3000);
    await page.keyboard.press("Enter"); // 次の画面へ(デモでも Enter で進む)
    await settle(page, 3000);
    await shoot(page, "x-02-demo-screen");
  });
  await desk.context.close();
});

test("撮影結果の確認", () => {
  expect(failed, `撮れなかった画像: ${failed.map((f) => `${f.name}(${f.reason})`).join(", ")}`).toEqual([]);
});
