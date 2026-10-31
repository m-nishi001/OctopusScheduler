import type { APIRequestContext } from "@playwright/test";
import { ADMIN_ID, ADMIN_PASSWORD, adminRpc, expect, newDevice, test } from "./fixtures";

/**
 * 受付QR(参加者個別のログインキー)と、役割(管理者 / 参加者)ごとの入口の出し分け。
 * 参加者は各テストの中で作り、終わったら消す(他のテストの名簿に影響しない)。
 * 実 workerd 上で、参加者を別々のブラウザコンテキスト(=別のスマホ)として同時に動かす。
 */

const CROWD = 10;
const PASSWORD = "participant-pw-1234";
const ids = Array.from({ length: CROWD }, (_, i) => `p0-e2e-${String(i + 1).padStart(2, "0")}`);
const keys = new Map<string, string>();

const qrUrl = (id: string, key: string) => `/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`;

test.describe.configure({ mode: "serial" });

async function createParticipants(request: APIRequestContext) {
  for (const id of ids) {
    await adminRpc(request, "accounts_addMember", { id, name: `参加者${id.slice(-2)}` });
    await adminRpc(request, "accounts_setPassword", { id, password: PASSWORD });
    const { key } = await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id });
    keys.set(id, key);
  }
}

async function removeParticipants(request: APIRequestContext) {
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
}

test.beforeAll(async ({ request }) => {
  await createParticipants(request);
});

test.afterAll(async ({ request }) => {
  await removeParticipants(request);
});

test.describe("受付QRでのログイン", () => {
  test("QRのURLを開くと、そのままログインして参加者ポータルへ。キーはURLに残らない", async ({ browser }) => {
    const [id] = ids;
    const d = await newDevice(browser, { mobile: true });
    await d.page.goto(qrUrl(id, keys.get(id)!));
    await expect(d.page.getByTestId("home-greeting")).toContainText("参加者01 さん");
    await expect(d.page).toHaveURL(/#\/p$/);
    expect(d.page.url()).not.toContain(keys.get(id)!);

    // リロードしてもログインは維持される
    await d.page.reload();
    await expect(d.page.getByTestId("home-greeting")).toBeVisible();
    await d.context.close();
  });

  test("キーを外部のQR生成サービスなどに送らない", async ({ browser }) => {
    const [id] = ids;
    const d = await newDevice(browser, { mobile: true });
    const external: string[] = [];
    d.page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.host !== new URL(process.env.BASE!).host) external.push(req.url());
    });
    await d.page.goto(qrUrl(id, keys.get(id)!));
    await expect(d.page.getByTestId("home-greeting")).toBeVisible();
    expect(external.filter((u) => u.includes(keys.get(id)!))).toEqual([]);
    await d.context.close();
  });

  test("無効なキーはログインできず、フォームからID/パスワードで入れる", async ({ browser }) => {
    const [id] = ids;
    const d = await newDevice(browser, { mobile: true });
    await d.page.goto(qrUrl(id, "0".repeat(64)));
    await expect(d.page.getByText("QRコードでログインできませんでした")).toBeVisible();
    await expect(d.page).toHaveURL(/#\/login$/);
    await expect(d.page.locator('input[autocomplete="username"]')).toHaveValue(id);

    await d.page.locator('input[type="password"]').fill(PASSWORD);
    await d.page.getByRole("button", { name: "ログイン" }).click();
    await expect(d.page.getByTestId("home-greeting")).toBeVisible();
    await d.context.close();
  });

  test("再発行すると古いキーは使えず、新しいキーで入れる。失効しても使えない", async ({ browser, request }) => {
    const id = ids[1];
    const old = keys.get(id)!;
    const { key } = await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id });
    keys.set(id, key);

    const a = await newDevice(browser, { mobile: true });
    await a.page.goto(qrUrl(id, old));
    await expect(a.page.getByText("QRコードでログインできませんでした")).toBeVisible();
    await a.context.close();

    const b = await newDevice(browser, { mobile: true });
    await b.page.goto(qrUrl(id, key));
    await expect(b.page.getByTestId("home-greeting")).toBeVisible();
    await b.context.close();

    await adminRpc(request, "accounts_revokeLoginKey", { id });
    const c = await newDevice(browser, { mobile: true });
    await c.page.goto(qrUrl(id, key));
    await expect(c.page.getByText("QRコードでログインできませんでした")).toBeVisible();
    await c.context.close();
  });

  test("管理者には受付QRを発行できない", async ({ request }) => {
    await expect(adminRpc(request, "accounts_issueLoginKey", { id: ADMIN_ID })).rejects.toThrow(/non-admin/);
  });
});

test.describe("役割ごとの入口", () => {
  test("参加者は管理画面を直打ちしても参加者ポータルへ戻される", async ({ browser }) => {
    const [id] = ids;
    const d = await newDevice(browser, { mobile: true });
    await d.page.goto("/#/login");
    await d.page.locator('input[autocomplete="username"]').fill(id);
    await d.page.locator('input[type="password"]').fill(PASSWORD);
    await d.page.getByRole("button", { name: "ログイン" }).click();
    await expect(d.page).toHaveURL(/#\/p$/);

    for (const path of ["/home", "/settings", "/sessions", "/execute", "/session/console/whatever"]) {
      await d.page.goto(`/#${path}`);
      await expect(d.page.getByTestId("home-greeting")).toBeVisible();
      await expect(d.page).toHaveURL(/#\/p$/);
    }
    // ログイン済みなら /login を開いても参加者ポータルへ
    await d.page.goto("/#/login");
    await expect(d.page).toHaveURL(/#\/p$/);
    await d.context.close();
  });

  test("参加者のサーバー権限は管理者APIに及ばない(UIを迂回しても拒否される)", async ({ browser }) => {
    const [id] = ids;
    const d = await newDevice(browser, { mobile: true });
    await d.page.goto(qrUrl(id, keys.get(id)!));
    await expect(d.page.getByTestId("home-greeting")).toBeVisible();
    const token = await d.page.evaluate(() => localStorage.getItem("octopus-session-token"));
    expect(token).toBeTruthy();
    for (const name of ["accounts_listAccounts", "accounts_issueLoginKey", "accounts_setPassword", "sessionHub_listSessions"]) {
      const res = await d.page.request.post("/rpc", { data: { name, args: { __octopusAuth: token, args: { id, password: "hacked-password-1" } } } });
      const body = await res.text();
      expect(body, name).toContain("Unauthorized");
    }
    await d.context.close();
  });

  test("管理者は同じURLから入って管理画面に着き、参加者ポータルも開ける", async ({ browser }) => {
    const d = await newDevice(browser);
    await d.page.goto("/");
    await expect(d.page).toHaveURL(/#\/login/);
    await d.page.locator('input[autocomplete="username"]').fill(ADMIN_ID);
    await d.page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await d.page.getByRole("button", { name: "ログイン" }).click();
    await expect(d.page).toHaveURL(/#\/home$/);
    await d.page.goto("/#/p");
    await expect(d.page.getByTestId("home-greeting")).toBeVisible();
    await d.context.close();
  });
});

test.describe("管理画面からの受付QR発行", () => {
  test("参加者の行から発行するとQRが表示され、閉じると表示できない。再発行は確認が要る", async ({ browser, request }) => {
    const id = ids[2];
    await adminRpc(request, "accounts_revokeLoginKey", { id });
    const admin = await newDevice(browser, { signedIn: true });
    const external: string[] = [];
    admin.page.on("request", (req) => {
      if (new URL(req.url()).host !== new URL(process.env.BASE!).host) external.push(req.url());
    });
    await admin.page.goto("/#/settings");
    await admin.page.getByRole("tab", { name: "メンバー" }).click();
    const row = admin.page.locator("tbody tr", { hasText: id });
    await expect(row).toContainText("未発行");

    await row.getByRole("button", { name: /受付QRを発行/ }).click();
    const sheet = admin.page.getByTestId("login-qr-sheet");
    await expect(sheet.locator("img")).toHaveAttribute("src", /^data:image\/gif/);
    await expect(sheet).toContainText(`ID: ${id}`);
    // QRはブラウザ内で作り、外部のQR生成サービスへは送らない
    expect(external.filter((u) => /qrserver|qr/i.test(u))).toEqual([]);

    await admin.page.getByRole("button", { name: "閉じる" }).first().click();
    await expect(sheet).toHaveCount(0);
    await expect(row).toContainText("発行済み");

    // 再発行は確認ダイアログが出て、キャンセルすれば何も起きない
    await row.getByRole("button", { name: /受付QRを再発行/ }).click();
    await admin.page.getByRole("button", { name: "キャンセル" }).click();
    await expect(sheet).toHaveCount(0);
    await admin.context.close();
  });

  test("管理者の行には発行ボタンが出ない", async ({ browser }) => {
    const admin = await newDevice(browser, { signedIn: true });
    await admin.page.goto("/#/settings");
    await admin.page.getByRole("tab", { name: "メンバー" }).click();
    const row = admin.page.locator("tbody tr", { hasText: ADMIN_ID }).first();
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /受付QR/ })).toHaveCount(0);
    await admin.context.close();
  });
});

test.describe("受付の混雑", () => {
  test(`${CROWD}人が同時にQRを読み取っても、全員が自分の名前でログインできる`, async ({ browser, request }) => {
    // 直前までのテストで失効・再発行したキーに依存しないよう、全員のキーを発行し直す
    for (const id of ids) keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);

    const devices = await Promise.all(ids.map(() => newDevice(browser, { mobile: true })));
    // 受付で一斉に読み取った状況: 全員のログインを同時に始める
    await Promise.all(devices.map((d, i) => d.page.goto(qrUrl(ids[i], keys.get(ids[i])!))));
    for (const [i, d] of devices.entries()) {
      await expect(d.page.getByTestId("home-greeting"), ids[i]).toContainText(`参加者${ids[i].slice(-2)} さん`);
      await expect(d.page).toHaveURL(/#\/p$/);
    }
    await Promise.all(devices.map((d) => d.context.close()));
  });
});
