import { addParticipant, ADMIN_ID, ADMIN_PASSWORD, adminRpc, createSession, expect, isGas, loginByQr, newDevice, openAdvanced, publishPortal, removeParticipant, route, test } from "./fixtures";
import { expectNoHorizontalOverflow } from "./helpers/responsive";

/**
 * ホスト(投影)・管理・参加者の3種類の端末を、別々のブラウザコンテキストとして同時に動かす。
 * 実 workerd(Durable Object + WebSocket)上で、画面から見える挙動を通しで確認する。
 * 参加者は受付QRでログインした別々のスマホ。参加者・セッションは各テストの中で作り、終わったら消す。
 */

const PREFIX = "sf-e2e";
const ids = Array.from({ length: 5 }, (_, i) => `${PREFIX}-${i + 1}`);
const keys = new Map<string, string>();
const sessionIds: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  for (const [i, id] of ids.entries()) keys.set(id, await addParticipant(request, id, `参加者${i + 1}`));
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await removeParticipant(request, id).catch(() => undefined);
});

const login = (browser: import("@playwright/test").Browser, i = 0) => loginByQr(browser, ids[i], keys.get(ids[i])!);

test.describe("認証", () => {
  test("未ログインでは、管理画面も参加者ポータルもログイン画面へ", async ({ browser }) => {
    const d = await newDevice(browser);
    await d.page.goto("/#/sessions");
    await expect(d.page).toHaveURL(/#\/login/);
    await d.page.goto("/#/session/host/whatever");
    await expect(d.page).toHaveURL(/#\/login/);
    await d.page.goto("/#/session/console/whatever");
    await expect(d.page).toHaveURL(/#\/login/);
    await d.page.goto("/#/p");
    await expect(d.page).toHaveURL(/#\/login/);
    await d.context.close();
  });

  test("誤ったパスワードは拒否され、正しい認証情報でログインすると元の画面へ戻る", async ({ browser }) => {
    const d = await newDevice(browser);
    await d.page.goto("/#/sessions");
    await expect(d.page).toHaveURL(/#\/login/);
    await d.page.locator('input[autocomplete="username"]').fill(ADMIN_ID);
    await d.page.locator('input[type="password"]').fill("wrong-password-123");
    await d.page.getByRole("button", { name: "ログイン" }).click();
    await expect(d.page.getByText("Invalid id or password")).toBeVisible();
    await expect(d.page).toHaveURL(/#\/login/);

    await d.page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await d.page.getByRole("button", { name: "ログイン" }).click();
    await expect(d.page.getByRole("heading", { name: "セッション" })).toBeVisible();
    await expect(d.page).toHaveURL(/#\/sessions/);

    // ログイン状態はリロードしても維持される(誤操作対策)
    await d.page.reload();
    await expect(d.page.getByRole("heading", { name: "セッション" })).toBeVisible();
    await d.context.close();
  });
});

/** セッションを作り、参加者ポータルに公開する(参加者のスマホが自動で入る)。 */
async function openSession(adminPage: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext, label: string) {
  const created = await createSession(adminPage, label);
  sessionIds.push(created.id);
  await publishPortal(request, created.id);
  return created;
}

test.describe("ホスト・管理・参加者の通し", () => {
  test("作成 → ホスト起動 → 参加者ログイン → 遠隔で画面切り替え → 参加者の人数にも反映", async ({ browser, request }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await openSession(adminDev.page, request, "E2E会場");

    // 管理コンソール: ホスト未接続の警告
    await expect(adminDev.page.getByTestId("host-warning")).toBeVisible();
    await expect(adminDev.page.getByTestId("host-card")).toContainText("ホスト未接続");

    // ホスト(プロジェクター): 参加コードやQRは出さず、ログインの案内を出す
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toContainText("E2E会場");
    await expect(host.page.getByTestId("host-guide")).toContainText("ログイン");
    await expect(host.page.locator("img.session-qr__image")).toHaveCount(0);

    // 参加者(スマホ・受付QRでログイン済み)
    const phone = await login(browser, 0);
    await expect(phone.page.getByTestId("home-greeting")).toContainText("参加者1");

    // 管理コンソールとホストに参加者が反映される(在席はまとめて配信される)
    await expect(adminDev.page.getByTestId("host-card")).toContainText("ホスト接続中");
    await expect(adminDev.page.getByTestId("host-card")).toContainText("参加者 1 人");
    await expect(adminDev.page.getByTestId("host-warning")).toBeHidden();
    await expect(host.page.getByTestId("host-count")).toContainText("1");

    // 遠隔操作: ホストの画面を切り替える
    await openAdvanced(adminDev.page);
    await adminDev.page.getByRole("button", { name: "ジャックポット: 結果" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-result");
    // 隅の接続バッジは演出画面でも出続ける
    await expect(host.page.getByTestId("host-badge")).toContainText("E2E会場");
    // 管理コンソール: 表示中の画面と操作ログ、ホストの適用済み(未適用0件)
    await expect(adminDev.page.getByTestId("now")).toContainText("結果表示中");
    await expect(adminDev.page.getByTestId("log")).toContainText("session.navigate");
    await expect(adminDev.page.getByTestId("host-card")).not.toContainText("未適用のコマンド");

    // ロビーに戻す
    await adminDev.page.getByRole("button", { name: "ロビー" }).click();
    await expect.poll(() => route(host.page)).toBe(`/session/host/${id}`);

    await publishPortal(request, id, false);
    for (const d of [adminDev, host, phone]) await d.context.close();
  });

  test("ホストが無操作でも接続中のままで、画面を閉じると未接続になる", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await createSession(adminDev.page, "死活会場");
    sessionIds.push(id);
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(adminDev.page.getByTestId("host-card")).toContainText("ホスト接続中");

    // 状態が変わらないまま「途絶」の閾値(20秒)を十分に超えても、接続中のまま
    await adminDev.page.waitForTimeout(30_000);
    await expect(adminDev.page.getByTestId("host-card")).toContainText("ホスト接続中");
    await expect(adminDev.page.getByTestId("host-card")).not.toContainText("途絶");

    // ホスト画面を閉じると、切断が配信されて未接続になる。
    // GAS には切断の通知(WebSocket)が無く、ホストの応答が途絶えて20秒たつと「ホストの応答が○秒途絶えています」になる。
    await host.context.close();
    await expect(adminDev.page.getByTestId("host-card")).toContainText(isGas ? /ホストの応答が\d+秒途絶えています/ : "ホスト未接続", { timeout: isGas ? 60_000 : 15_000 });

    await adminDev.context.close();
  });

  test("ホストのリロードから自動復帰し、その後の遠隔操作も引き続き届く", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await createSession(adminDev.page, "リロード会場");
    sessionIds.push(id);
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toContainText("リロード会場");
    await expect(adminDev.page.getByTestId("host-card")).toContainText("ホスト接続中");

    // 演出画面に切り替えた状態でリロード
    await openAdvanced(adminDev.page);
    await adminDev.page.getByRole("button", { name: "ジャックポット: 結果" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-result");
    await host.page.reload();
    await expect(host.page.getByTestId("host-badge")).toContainText("・接続中");
    // ホスト端末が増えていない(同じ端末として復帰)= 引き継ぎ確認が出ていない
    await expect(host.page.getByText("ホストを引き継ぎますか")).toBeHidden();

    await adminDev.page.getByRole("button", { name: "ロビー" }).click();
    await expect.poll(() => route(host.page)).toBe(`/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toContainText("リロード会場");
    for (const d of [adminDev, host]) await d.context.close();
  });

  test("ジャックポットのエンディングが終わると、ホストは自動でロビーへ戻る", async ({ browser, request }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await openSession(adminDev.page, request, "自動復帰会場");
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toContainText("自動復帰会場");

    // イベントを開催しておく(エンディングが終わってロビーへ戻ると、自動で終了する)
    await openAdvanced(adminDev.page);
    await adminDev.page.getByTestId("event-title").fill("自動終了イベント");
    await adminDev.page.getByRole("button", { name: "イベントを開始" }).click();
    await expect(adminDev.page.getByTestId("event-state")).toContainText("自動終了イベント");

    // エンディングを映す(画面設定が空のe2e環境では、すぐに最後まで流れ終わる)。管理端末は何も押さない。
    await adminDev.page.getByRole("button", { name: "ジャックポット: エンディング" }).click();
    await expect.poll(() => route(host.page), { timeout: 30_000 }).toBe(`/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toContainText("自動復帰会場");
    await expect(host.page.getByTestId("host-badge")).toContainText("・接続中");
    // ロビーへ戻ったので、イベントは自動で終了している
    await expect(adminDev.page.getByTestId("event-state")).toContainText("イベントは開催していません");

    await publishPortal(request, id, false);
    for (const d of [adminDev, host]) await d.context.close();
  });

  test("参加者の誤リロードで自動復帰する(ログインは保たれ、人数も増えない)", async ({ browser, request }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await openSession(adminDev.page, request, "復帰会場");
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();

    const phone = await login(browser, 0);
    await expect(host.page.getByTestId("host-count")).toContainText("1");

    // 誤リロード 3 回。ログインし直さずに戻り、参加者数も増えない(同じ端末として復帰)
    for (let i = 0; i < 3; i++) {
      await phone.page.reload();
      await expect(phone.page.getByTestId("home-greeting")).toBeVisible();
      await expect(phone.page.getByTestId("portal-conn")).toContainText("接続中");
    }
    await expect(adminDev.page.getByTestId("host-card")).toContainText("参加者 1 人");

    await publishPortal(request, id, false);
    for (const d of [adminDev, host, phone]) await d.context.close();
  });

  test("参加者を5人入れても、人数が正しく反映される", async ({ browser, request }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await openSession(adminDev.page, request, "多人数会場");
    const phones = await Promise.all(ids.map((_, i) => login(browser, i)));
    await expect(adminDev.page.getByTestId("host-card")).toContainText("参加者 5 人");
    // 1人がログアウト(退出)すると減る。GAS には切断の通知が無く、応答が途絶えて CLIENT_ALIVE_MS(60秒)たつと減る。
    await phones[0].page.getByRole("link", { name: "マイページ" }).click();
    await phones[0].page.getByTestId("me-signout").click();
    await expect(adminDev.page.getByTestId("host-card")).toContainText("参加者 4 人", { timeout: isGas ? 90_000 : 15_000 });

    await publishPortal(request, id, false);
    for (const d of [adminDev, ...phones]) await d.context.close();
  });
});

test.describe("ホストの引き継ぎと終了", () => {
  test("別の端末がホストを引き継ぐと、旧ホストは操作を受け付けず、新ホストだけが動く", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await createSession(adminDev.page, "引き継ぎ会場");
    sessionIds.push(id);

    const host1 = await newDevice(browser, { signedIn: true, projector: true });
    await host1.page.goto(`/#/session/host/${id}`);
    await expect(host1.page.locator(".host-view__title")).toBeVisible();

    const host2 = await newDevice(browser, { signedIn: true, projector: true });
    await host2.page.goto(`/#/session/host/${id}`);
    await expect(host2.page.getByText("ホストを引き継ぎますか?")).toBeVisible();
    await host2.page.getByRole("button", { name: "引き継ぐ" }).click();
    await expect(host2.page.locator(".host-view__title")).toContainText("引き継ぎ会場");

    // 旧ホストには引き継がれた旨が出る
    await expect(host1.page.getByTestId("replaced")).toBeVisible();

    // 以後の遠隔操作は新ホストだけに届く
    await openAdvanced(adminDev.page);
    await adminDev.page.getByRole("button", { name: "ジャックポット: 説明" }).click();
    await expect.poll(() => route(host2.page)).toBe("/execute/jackpot-description");
    expect(await route(host1.page)).toBe(`/session/host/${id}`);

    // 旧ホストは「ホストに戻す」で引き継ぎ返せる
    await host1.page.getByRole("button", { name: "この端末をホストに戻す" }).click();
    await expect(host1.page.locator(".host-view__title")).toBeVisible();
    await expect(host2.page.getByTestId("host-badge")).toContainText("別の端末にホストを引き継がれました");
    for (const d of [adminDev, host1, host2]) await d.context.close();
  });

  test("セッションを終了すると、ホスト・管理・参加者の全端末に終了が伝わる", async ({ browser, request }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id, name } = await openSession(adminDev.page, request, "終了会場");
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    const phone = await login(browser, 0);

    // 一覧の画面から終了(確認ダイアログあり)
    const lister = await newDevice(browser, { signedIn: true });
    await lister.page.goto("/#/sessions");
    const row = lister.page.locator("tbody tr", { hasText: name });
    await row.getByRole("button", { name: "終了" }).click();
    await lister.page.getByRole("button", { name: "終了する" }).click();
    await expect(row).toContainText("終了");

    // 参加者は、公開中のセッションがなくなるので「イベント待ち」に戻る
    await expect(phone.page.getByTestId("portal-conn")).toContainText("イベント待ち");
    await expect(adminDev.page.getByText("このセッションは終了しました")).toBeVisible();
    // ホストの画面: 隅のバッジ(セッションは終了しました)と、ロビーの接続表示の両方が終了を示す
    await expect(host.page.getByTestId("host-badge")).toContainText("セッションは終了しました");
    await expect(host.page.locator(".connection-banner")).toHaveText("セッションは終了しました");
    for (const d of [adminDev, host, phone, lister]) await d.context.close();
  });
});

test.describe("異常系・環境差", () => {
  test("存在しないセッションの管理コンソール・ホスト画面はエラーを表示する", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    await d.page.goto("/#/session/console/no-such-session");
    await expect(d.page.getByRole("alert")).toContainText("セッションが見つかりません");
    await d.page.goto("/#/session/host/no-such-session");
    await expect(d.page.getByRole("alert")).toContainText("セッションが見つかりません");
    await expect(d.page.getByRole("button", { name: "もう一度接続する" })).toBeVisible();
    await d.context.close();
  });

  test("WebSocket が使えない回線でも、ポーリングに切り替わって参加・反映できる", async ({ browser, request }) => {
    test.skip(isGas, "Cloudflare 専用(GAS には WebSocket が無く、常にポーリングで動く。ほかのテストがその経路を通る)");
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await openSession(adminDev.page, request, "WS不可会場");
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();

    const phone = await newDevice(browser, { mobile: true });
    await phone.context.route("**/ws/**", (r) => r.abort()); // 社内ネットワーク等で WebSocket が遮断されている想定
    await phone.page.goto(`/#/login?id=${ids[0]}&key=${encodeURIComponent(keys.get(ids[0])!)}`);
    await expect(phone.page.getByTestId("home-greeting")).toBeVisible();
    // ポーリングへ切り替わった後も、人数が反映される
    await expect(adminDev.page.getByTestId("host-card")).toContainText("参加者 1 人", { timeout: 40_000 });
    await expect(phone.page.getByTestId("portal-conn")).toContainText("接続中", { timeout: 40_000 });

    await publishPortal(request, id, false);
    for (const d of [adminDev, host, phone]) await d.context.close();
  });

  test("スマホの画面幅で横スクロールが出ない(ログイン前・ログイン後)", async ({ browser }) => {
    const phone = await newDevice(browser, { mobile: true });
    await phone.page.goto("/#/login");
    await expect(phone.page.locator('input[type="password"]')).toBeVisible();
    await expectNoHorizontalOverflow(phone.page, "ログイン前");
    await phone.context.close();

    // ログイン後(ホーム)も同じ。同じページでハッシュだけ変えると読み込み直されないので、別の端末で開く
    const loggedIn = await newDevice(browser, { mobile: true });
    await loggedIn.page.goto(`/#/login?id=${ids[0]}&key=${encodeURIComponent(keys.get(ids[0])!)}`);
    await expect(loggedIn.page.getByTestId("home-greeting")).toBeVisible();
    await expectNoHorizontalOverflow(loggedIn.page, "ログイン後");
    await loggedIn.context.close();
  });

  test("ブラウザがオフラインになっても落ちず、復帰すると自動で再接続する", async ({ browser, request }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await openSession(adminDev.page, request, "オフライン会場");
    const phone = await login(browser, 0);

    await phone.context.setOffline(true);
    // 切断を検知して「再接続中」と表示する(画面は壊れず、ホームは表示されたまま)
    await expect(phone.page.getByTestId("portal-conn")).toContainText("再接続中", { timeout: 90_000 });
    await expect(phone.page.getByTestId("home-greeting")).toBeVisible();
    await phone.context.setOffline(false);
    await expect(phone.page.getByTestId("portal-conn")).toContainText("接続中", { timeout: 90_000 });
    await expect(phone.page.getByTestId("home-greeting")).toBeVisible();

    await publishPortal(request, id, false);
    await adminDev.context.close();
    await phone.context.close();
  });
});
