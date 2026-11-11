import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { ADMIN_ID, adminRpc, expect, newDevice, test } from "./fixtures";

/**
 * 設定>メンバーの CSV の「管理者」列(あり/なし)。
 * - 取り込むと管理者になる(新しい人も)。管理者にした人の受付QRのキーは消える。外すと管理者でなくなる。
 * - ログイン中の自分の管理者権限を外す行は、プレビューでエラーになり、確定できない(サーバーには何も送らない)。
 * - 書き出した CSV には「管理者」列が付く。クイズ>メンバー管理には、この列が無い。
 */

const PROMOTED = "csv-adm-1";
const NEWBIE = "csv-adm-new";
const table = (text: string) => ({ name: "members.csv", mimeType: "text/csv", buffer: Buffer.from(text, "utf-8") });

type Account = { id: string; name: string; isAdmin?: boolean; hasLoginKey?: boolean };
const accounts = (request: Parameters<typeof adminRpc>[0]) => adminRpc<Account[]>(request, "accounts_listAccounts", {});

async function openImportDialog(page: Page) {
  await page.goto("/#/settings?tab=members");
  await page.getByTestId("table-import-open").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.afterAll(async ({ request }) => {
  for (const id of [PROMOTED, NEWBIE]) await adminRpc(request, "accounts_deleteMember", { id }).catch(() => undefined);
});

test.describe("名簿 CSV の管理者列", () => {
  test("あり で管理者になり(新しい人も)、受付QRのキーが消える。なし で外れる", async ({ browser, request }) => {
    await adminRpc(request, "accounts_addMember", { id: PROMOTED, name: "管理候補" });
    await adminRpc(request, "accounts_issueLoginKey", { id: PROMOTED });
    expect((await accounts(request)).find((m) => m.id === PROMOTED)).toMatchObject({ hasLoginKey: true });

    const admin = await newDevice(browser, { signedIn: true });
    await openImportDialog(admin.page);
    await admin.page.getByTestId("table-import-table").setInputFiles(table(`ID,名前,管理者\r\n${PROMOTED},管理候補,あり\r\n${NEWBIE},新管理者,あり\r\n`));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("追加 1 / 更新 1 / 変更なし 0 / 削除 0 / エラー 0");
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText("追加 1 / 更新 1", { timeout: 30_000 });

    const after = await accounts(request);
    expect(after.find((m) => m.id === PROMOTED)).toMatchObject({ isAdmin: true });
    expect(after.find((m) => m.id === PROMOTED)?.hasLoginKey).toBeFalsy();
    expect(after.find((m) => m.id === NEWBIE)).toMatchObject({ isAdmin: true });

    await admin.page.getByRole("dialog").getByRole("button", { name: "閉じる" }).last().click();
    await expect(admin.page.getByRole("dialog")).toBeHidden();

    // 書き出し直すと、管理者の列に あり が出て、そのまま取り込むと全行「変更なし」
    const download = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const csvText = readFileSync(await (await download).path(), "utf-8");
    const lines = csvText.replace("﻿", "").split("\r\n");
    expect(lines[0]).toBe("ID,名前,写真,管理者");
    expect(lines).toContain(`${PROMOTED},管理候補,,あり`);
    expect(lines).toContain(`${ADMIN_ID},${after.find((m) => m.id === ADMIN_ID)!.name},,あり`);
    await admin.page.getByTestId("table-import-open").click();
    await admin.page.getByTestId("table-import-table").setInputFiles(table(csvText));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText(/変更なし \d+ \/ 削除 0 \/ エラー 0/);
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("追加 0 / 更新 0");

    // なし で外れる(名前が同じでも書かれる)
    await admin.page.getByTestId("table-import-table").setInputFiles(table(`ID,名前,管理者\r\n${PROMOTED},管理候補,なし\r\n`));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("更新 1");
    await admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" }).click();
    await expect(admin.page.getByTestId("table-import-result")).toContainText("更新 1", { timeout: 30_000 });
    expect((await accounts(request)).find((m) => m.id === PROMOTED)?.isAdmin).toBeFalsy();
    await admin.context.close();
  });

  test("ログイン中の自分の管理者権限を外す CSV は、プレビューでエラーになり、取り込めない", async ({ browser, request }) => {
    const me = (await accounts(request)).find((m) => m.id === ADMIN_ID)!;
    const admin = await newDevice(browser, { signedIn: true });
    let applyCalls = 0;
    admin.page.on("request", (r) => {
      if (r.url().endsWith("/rpc") && r.postDataJSON()?.name === "accounts_applyRoster") applyCalls++;
    });
    await openImportDialog(admin.page);
    await admin.page.getByTestId("table-import-table").setInputFiles(table(`ID,名前,管理者\r\n${ADMIN_ID},${me.name},なし\r\n`));
    await expect(admin.page.getByTestId("table-import-counts")).toContainText("エラー 1");
    await expect(admin.page.locator('[data-testid="table-import-row"][data-status="error"]')).toContainText("自分の管理者権限は外せません");
    await expect(admin.page.getByRole("dialog").getByRole("button", { name: "取り込む" })).toBeDisabled();
    // あり/なし 以外の書き方もエラー
    await admin.page.getByTestId("table-import-table").setInputFiles(table(`ID,名前,管理者\r\n${PROMOTED},管理候補,ON\r\n`));
    await expect(admin.page.locator('[data-testid="table-import-row"][data-status="error"]')).toContainText("「あり」か「なし」");
    expect(applyCalls).toBe(0);
    expect((await accounts(request)).find((m) => m.id === ADMIN_ID)?.isAdmin).toBe(true);
    await admin.context.close();
  });

  test("サーバーも、自分の管理者権限を外す呼び出しを拒否する(画面を通さなくても)", async ({ request }) => {
    const me = (await accounts(request)).find((m) => m.id === ADMIN_ID)!;
    await expect(adminRpc(request, "accounts_applyRoster", { upserts: [{ id: ADMIN_ID, name: me.name, isAdmin: false }], deleteIds: [] })).rejects.toThrow();
    expect((await accounts(request)).find((m) => m.id === ADMIN_ID)?.isAdmin).toBe(true);
  });

  test("クイズ>メンバー管理の書き出しには、管理者の列が無い", async ({ browser }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/quiz-admin/members");
    const download = admin.page.waitForEvent("download");
    await admin.page.getByTestId("table-export").click();
    const csvText = readFileSync(await (await download).path(), "utf-8");
    expect(csvText.replace("﻿", "").split("\r\n")[0]).toBe("ID,名前,写真");
    await admin.context.close();
  });
});
