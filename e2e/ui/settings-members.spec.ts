import type { Page } from "@playwright/test";
import { makeBadgePng } from "../../scripts/seed-content.js";
import { ADMIN_ID, adminRpc, expect, newDevice, test } from "./fixtures";

/**
 * 設定の「メンバー」タブ1つで、名簿の人ごとに 写真・パスワード・管理者の権限・受付QR を扱える。
 * (以前は「メンバー」と「アカウント」の2タブに分かれていた。古いリンクの ?tab=accounts は「メンバー」に移る)
 * 参加者は各テストの中で作り、終わったら消す。
 */

const IDS = ["sm-e2e-01", "sm-e2e-02"];
const nameOf = (id: string) => `統合テスト${id.slice(-2)}`;
const PHOTO = makeBadgePng("#7c3aed", "#312e81", { width: 800, height: 600 });
const PASSWORD = "e2e-member-pass-1";

test.describe.configure({ mode: "serial" });

type Listed = { id: string; name: string; isAdmin?: boolean; hasPassword?: boolean; hasLoginKey?: boolean; photo?: string };
const accountOf = async (request: Parameters<typeof adminRpc>[0], id: string) =>
  (await adminRpc<Listed[]>(request, "accounts_listAccounts", {})).find((m) => m.id === id);

const rowOf = (page: Page, id: string) => page.locator("tbody tr", { hasText: id });

async function cleanup(request: Parameters<typeof adminRpc>[0]) {
  for (const id of IDS) await adminRpc(request, "accounts_deleteMember", { id }).catch(() => undefined);
}
test.beforeAll(async ({ request }) => cleanup(request));
test.afterAll(async ({ request }) => cleanup(request));

/** 追加ダイアログで ID・名前(と、あれば写真・パスワード)を入れて保存する。 */
async function addMember(page: Page, id: string, options: { photo?: boolean; password?: string } = {}) {
  await page.getByTestId("member-add").click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("input[type=text]").nth(0).fill(id);
  await dialog.locator("input[type=text]").nth(1).fill(nameOf(id));
  if (options.photo) {
    await dialog.getByTestId("member-photo-input").setInputFiles({ name: "face.png", mimeType: "image/png", buffer: PHOTO });
    await expect(dialog.getByTestId("member-photo-preview")).toBeVisible();
  }
  if (options.password) await dialog.getByTestId("member-password").fill(options.password);
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("設定のメンバータブ(名簿とアカウントを1つに統合)", () => {
  test("タブは「アカウント」が無く「メンバー」だけ。古い ?tab=accounts は「メンバー」に移る", async ({ browser }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/settings?tab=accounts");
    await expect(admin.page.getByRole("tab", { name: "メンバー" })).toHaveAttribute("aria-selected", "true");
    await expect(admin.page).toHaveURL(/tab=members/);
    await expect(admin.page.getByRole("tab", { name: "アカウント" })).toHaveCount(0);
    await expect(admin.page.getByTestId("member-add")).toBeVisible();
    await admin.context.close();
  });

  test("1つの表に ID/写真/名前/権限/パスワード/受付QR/操作 が並び、追加・パスワード・写真・QR発行までここで済む", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/settings?tab=members");
    const heads = admin.page.locator("thead th");
    await expect(heads.filter({ hasText: /^(ID|写真|名前|権限|パスワード|受付QR|操作)$/ })).toHaveCount(7);

    await addMember(admin.page, IDS[0], { photo: true, password: PASSWORD });
    const row = rowOf(admin.page, IDS[0]);
    await expect(row).toContainText(nameOf(IDS[0]));
    await expect(row).toContainText("一般");
    await expect(row).toContainText("設定済み");
    await expect(row).toContainText("未発行");
    await expect(row.getByTestId("member-thumb")).toBeVisible();
    const saved = await accountOf(request, IDS[0]);
    expect(saved).toMatchObject({ name: nameOf(IDS[0]), hasPassword: true });
    expect(saved?.photo).toMatch(/^[0-9a-f]{16}$/);

    // 受付QRの発行(シートに出る)→ 閉じると「発行済み」
    await row.getByRole("button", { name: /受付QRを発行/ }).click();
    const sheet = admin.page.getByTestId("login-qr-sheet");
    await expect(sheet).toContainText(`ID: ${IDS[0]}`);
    await expect(sheet.getByRole("img")).toHaveAttribute("src", /^data:image\/gif/);
    await admin.page.getByRole("button", { name: "閉じる" }).first().click();
    await expect(row).toContainText("発行済み");

    // 再読み込みしても、写真・パスワード・QRの状態が1回の読み込みで揃って出る
    await admin.page.reload();
    await expect(rowOf(admin.page, IDS[0]).getByTestId("member-thumb")).toBeVisible();
    await expect(rowOf(admin.page, IDS[0])).toContainText("設定済み");
    await expect(rowOf(admin.page, IDS[0])).toContainText("発行済み");
    await admin.context.close();
  });

  test("編集で管理者にする/外す、パスワードを後から設定できる。自分の管理者権限は外せず、自分は削除できない", async ({ browser, request }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/settings?tab=members");
    await addMember(admin.page, IDS[1]);
    const row = rowOf(admin.page, IDS[1]);
    await expect(row).toContainText("未設定");

    await row.getByRole("button", { name: "編集" }).click();
    let dialog = admin.page.getByRole("dialog");
    await dialog.getByTestId("member-is-admin").check();
    await dialog.getByTestId("member-password").fill(PASSWORD);
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText("管理者");
    await expect(row).toContainText("設定済み");
    // 管理者の行には受付QRの操作が出ない
    await expect(row.getByRole("button", { name: /受付QR/ })).toHaveCount(0);
    expect(await accountOf(request, IDS[1])).toMatchObject({ isAdmin: true, hasPassword: true });

    await row.getByRole("button", { name: "編集" }).click();
    dialog = admin.page.getByRole("dialog");
    await dialog.getByTestId("member-is-admin").uncheck();
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText("一般");

    // 自分(ログイン中の管理者)の権限は外せず、削除もできない
    const me = admin.page.locator("tbody tr", { hasText: ADMIN_ID }).first();
    await me.getByRole("button", { name: "編集" }).click();
    dialog = admin.page.getByRole("dialog");
    await dialog.getByTestId("member-is-admin").uncheck();
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).toContainText("ログイン中のアカウントの管理者権限は外せません");
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await me.getByRole("button", { name: "削除" }).click();
    await expect(admin.page.getByText("ログイン中のアカウントは削除できません")).toBeVisible();
    expect((await accountOf(request, ADMIN_ID))?.isAdmin).toBe(true);

    // 削除
    await row.getByRole("button", { name: "削除" }).click();
    await admin.page.getByRole("button", { name: /^削除$/ }).last().click();
    await expect(rowOf(admin.page, IDS[1])).toHaveCount(0);
    expect(await accountOf(request, IDS[1])).toBeUndefined();
    await admin.context.close();
  });

  test("スマホの画面幅でも、横にはみ出さず、追加・編集・QR発行ができる", async ({ browser, request }) => {
    await cleanup(request); // 前のテストで作った人を残さない
    const phone = await newDevice(browser, { signedIn: true, mobile: true });
    await phone.page.goto("/#/settings?tab=members");
    await expect(phone.page.getByTestId("member-add")).toBeVisible();

    const overflow = () =>
      phone.page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    const fits = async (message: string) => {
      const { scroll, inner } = await overflow();
      expect(scroll, message).toBeLessThanOrEqual(inner);
    };
    await fits("一覧");
    // ツールバーのボタンは折り返して全部見える
    for (const testId of ["member-add", "member-export", "member-import-open", "member-issue-missing"]) {
      const box = await phone.page.getByTestId(testId).boundingBox();
      expect(box, testId).not.toBeNull();
      expect(box!.x + box!.width, testId).toBeLessThanOrEqual(390 + 1);
    }

    await addMember(phone.page, IDS[0], { password: PASSWORD });
    const row = rowOf(phone.page, IDS[0]);
    await expect(row).toBeVisible();
    await fits("追加後");
    // 行のどの項目も、ラベル付きで読める(スマホでは表が縦並びのカードになる)
    for (const label of ["権限", "パスワード", "受付QR"]) await expect(row.locator(`td[data-label="${label}"]`)).toBeVisible();

    // 編集ダイアログは画面内に収まり、ログインの欄まで操作できる
    await row.getByRole("button", { name: "編集" }).click();
    const dialog = phone.page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
    await dialog.getByTestId("member-is-admin").scrollIntoViewIfNeeded();
    await expect(dialog.getByTestId("member-password")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "保存" })).toBeVisible();
    await fits("編集ダイアログ");
    await dialog.getByRole("button", { name: "キャンセル" }).click();

    // 受付QRの発行シート
    await row.getByRole("button", { name: /受付QRを発行/ }).click();
    const sheet = phone.page.getByTestId("login-qr-sheet");
    await expect(sheet.getByRole("img")).toBeVisible();
    await fits("QRシート");
    await expect(phone.page.getByRole("button", { name: "印刷" })).toBeVisible();
    await phone.page.getByRole("button", { name: "閉じる" }).first().click();
    await expect(row).toContainText("発行済み");
    expect((await accountOf(request, IDS[0]))?.hasLoginKey).toBe(true);
    await phone.context.close();
  });
});
