import { ADMIN_ID, ADMIN_PASSWORD, createSession, expect, newDevice, route, test } from "./fixtures";

/**
 * ホスト(投影)・管理・参加者の3種類の端末を、別々のブラウザコンテキストとして同時に動かす。
 * 実 workerd(Durable Object + WebSocket)上で、画面から見える挙動を通しで確認する。
 */

test.describe("認証", () => {
  test("未ログインでは管理画面からログイン画面へ。ポータルは公開のまま", async ({ browser }) => {
    const d = await newDevice(browser);
    await d.page.goto("/#/sessions");
    await expect(d.page).toHaveURL(/#\/login/);
    await d.page.goto("/#/session/host/whatever");
    await expect(d.page).toHaveURL(/#\/login/);
    await d.page.goto("/#/session/console/whatever");
    await expect(d.page).toHaveURL(/#\/login/);
    await d.page.goto("/#/portal");
    await expect(d.page.locator("#portal-code")).toBeVisible();
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

test.describe("ホスト・管理・参加者の通し", () => {
  test("作成 → ホスト起動 → 参加 → 遠隔で画面切り替え → 参加者の画面にも反映", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id, code } = await createSession(adminDev.page, "E2E会場");
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);

    // 管理コンソール: ホスト未接続の警告
    await expect(adminDev.page.getByTestId("host-warning")).toBeVisible();
    await expect(adminDev.page.getByTestId("host-card")).toContainText("ホスト未接続");

    // ホスト(プロジェクター)
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toContainText("E2E会場");
    await expect(host.page.locator(".session-qr__code")).toHaveText(code);
    await expect(host.page.locator("img.session-qr__image")).toHaveAttribute("src", /api\.qrserver\.com.*portal/);

    // 参加者(スマホ・未ログイン)
    const phone = await newDevice(browser, { mobile: true });
    await phone.page.goto("/#/portal");
    await phone.page.locator("#portal-code").fill(code.toLowerCase());
    await phone.page.getByRole("button", { name: "参加する" }).click();
    await expect(phone.page.locator(".portal__session")).toContainText("E2E会場");
    await expect(phone.page).toHaveURL(new RegExp(`#/portal/${code}$`));

    // 管理コンソールにホストと参加者が反映される(在席はまとめて配信される)
    await expect(adminDev.page.getByTestId("host-card")).toContainText("ホスト接続中");
    await expect(adminDev.page.getByTestId("people-card")).toContainText("参加者 1 人");
    await expect(adminDev.page.getByTestId("host-warning")).toBeHidden();
    await expect(host.page.locator(".host-view__presence")).toContainText("参加者 1 人");

    // 遠隔操作: ホストの画面を切り替える
    await adminDev.page.getByRole("button", { name: "ジャックポット: エンディング" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-ending");
    // 隅の接続バッジは演出画面でも出続ける
    await expect(host.page.getByTestId("host-badge")).toContainText("E2E会場");
    // 管理コンソール: 表示中の画面と操作ログ、ホストの適用済み(未適用0件)
    await expect(adminDev.page.getByTestId("host-card")).toContainText("/execute/jackpot-ending");
    await expect(adminDev.page.getByTestId("log")).toContainText("session.navigate");
    await expect(adminDev.page.getByTestId("host-card")).not.toContainText("未適用のコマンド");
    // 参加者のポータルにも、ホストの画面が反映される
    await expect(phone.page.locator(".portal__screen")).toHaveText("ジャックポット");

    // ロビーに戻す
    await adminDev.page.getByRole("button", { name: "ロビー(QR表示)" }).click();
    await expect.poll(() => route(host.page)).toBe(`/session/host/${id}`);
    await expect(host.page.locator(".session-qr__code")).toHaveText(code);

    for (const d of [adminDev, host, phone]) await d.context.close();
  });

  test("ホストのリロードから自動復帰し、その後の遠隔操作も引き続き届く", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await createSession(adminDev.page, "リロード会場");
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toContainText("リロード会場");
    await expect(adminDev.page.getByTestId("host-card")).toContainText("ホスト接続中");

    // 演出画面に切り替えた状態でリロード
    await adminDev.page.getByRole("button", { name: "ジャックポット: エンディング" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-ending");
    await host.page.reload();
    await expect(host.page.getByTestId("host-badge")).toContainText("・接続中");
    // ホスト端末が増えていない(同じ端末として復帰)= 引き継ぎ確認が出ていない
    await expect(host.page.getByText("ホストを引き継ぎますか")).toBeHidden();

    await adminDev.page.getByRole("button", { name: "ロビー(QR表示)" }).click();
    await expect.poll(() => route(host.page)).toBe(`/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toContainText("リロード会場");
    for (const d of [adminDev, host]) await d.context.close();
  });

  test("参加者の誤リロードで自動復帰する。URLのコードで直接参加もできる", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id, code } = await createSession(adminDev.page, "復帰会場");
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();

    const phone = await newDevice(browser, { mobile: true });
    await phone.page.goto(`/#/portal/${code}`); // QR から開いた想定
    await expect(phone.page.locator(".portal__session")).toContainText("復帰会場");
    await expect(host.page.locator(".host-view__presence")).toContainText("参加者 1 人");

    // 誤リロード 3 回。コードを入れ直さずに戻り、参加者数も増えない(同じ端末として復帰)
    for (let i = 0; i < 3; i++) {
      await phone.page.reload();
      await expect(phone.page.locator(".portal__session")).toContainText("復帰会場");
    }
    await expect(adminDev.page.getByTestId("people-card")).toContainText("参加者 1 人");

    // コード無しのURLに戻ってリロードしても復帰する
    await phone.page.goto("/#/portal");
    await phone.page.reload();
    await expect(phone.page.locator(".portal__session")).toContainText("復帰会場");
    for (const d of [adminDev, host, phone]) await d.context.close();
  });

  test("参加者を5人入れても、人数が正しく反映される", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { code } = await createSession(adminDev.page, "多人数会場");
    const phones = await Promise.all(Array.from({ length: 5 }, () => newDevice(browser, { mobile: true })));
    await Promise.all(phones.map((p) => p.page.goto(`/#/portal/${code}`)));
    for (const p of phones) await expect(p.page.locator(".portal__session")).toContainText("多人数会場");
    await expect(adminDev.page.getByTestId("people-card")).toContainText("参加者 5 人");
    // 1人が退出すると減る
    await phones[0].page.getByRole("button", { name: "退出する" }).click();
    await expect(adminDev.page.getByTestId("people-card")).toContainText("参加者 4 人");
    for (const d of [adminDev, ...phones]) await d.context.close();
  });
});

test.describe("ホストの引き継ぎと終了", () => {
  test("別の端末がホストを引き継ぐと、旧ホストは操作を受け付けず、新ホストだけが動く", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id } = await createSession(adminDev.page, "引き継ぎ会場");

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
    await adminDev.page.getByRole("button", { name: "ジャックポット: 説明" }).click();
    await expect.poll(() => route(host2.page)).toBe("/execute/jackpot-description");
    expect(await route(host1.page)).toBe(`/session/host/${id}`);

    // 旧ホストは「ホストに戻す」で引き継ぎ返せる
    await host1.page.getByRole("button", { name: "この端末をホストに戻す" }).click();
    await expect(host1.page.locator(".host-view__title")).toBeVisible();
    await expect(host2.page.getByTestId("host-badge")).toContainText("別の端末にホストを引き継がれました");
    for (const d of [adminDev, host1, host2]) await d.context.close();
  });

  test("セッションを終了すると、ホスト・管理・参加者の全端末に終了が伝わる", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id, code, name } = await createSession(adminDev.page, "終了会場");
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    const phone = await newDevice(browser, { mobile: true });
    await phone.page.goto(`/#/portal/${code}`);
    await expect(phone.page.locator(".portal__session")).toBeVisible();

    // 一覧の画面から終了(確認ダイアログあり)
    const lister = await newDevice(browser, { signedIn: true });
    await lister.page.goto("/#/sessions");
    const row = lister.page.locator("tbody tr", { hasText: name });
    await row.getByRole("button", { name: "終了" }).click();
    await lister.page.getByRole("button", { name: "終了する" }).click();
    await expect(row).toContainText("終了");

    await expect(phone.page.getByText("このセッションは終了しました")).toBeVisible();
    await expect(adminDev.page.getByText("このセッションは終了しました")).toBeVisible();
    // ホストの画面: 隅のバッジ(セッションは終了しました)と、ロビーの接続表示の両方が終了を示す
    await expect(host.page.getByTestId("host-badge")).toContainText("セッションは終了しました");
    await expect(host.page.locator(".connection-banner")).toHaveText("セッションは終了しました");

    // 終了済みのコードでは参加できない
    const late = await newDevice(browser, { mobile: true });
    await late.page.goto(`/#/portal/${code}`);
    await expect(late.page.getByRole("alert")).toContainText("参加コードが見つかりません");
    for (const d of [adminDev, host, phone, lister, late]) await d.context.close();
  });
});

test.describe("異常系・環境差", () => {
  test("存在しない参加コードはエラーを出して入力欄に留まる。大小文字・空白は吸収される", async ({ browser }) => {
    const phone = await newDevice(browser, { mobile: true });
    await phone.page.goto("/#/portal");
    await phone.page.locator("#portal-code").fill("zzzzzz");
    await phone.page.getByRole("button", { name: "参加する" }).click();
    await expect(phone.page.getByRole("alert")).toContainText("参加コードが見つかりません");
    await expect(phone.page.locator("#portal-code")).toBeVisible();
    // 6文字未満では押せない
    await phone.page.locator("#portal-code").fill("ab");
    await expect(phone.page.getByRole("button", { name: "参加する" })).toBeDisabled();
    await phone.context.close();
  });

  test("存在しないセッションの管理コンソール・ホスト画面はエラーを表示する", async ({ browser }) => {
    const d = await newDevice(browser, { signedIn: true });
    await d.page.goto("/#/session/console/no-such-session");
    await expect(d.page.getByRole("alert")).toContainText("セッションが見つかりません");
    await d.page.goto("/#/session/host/no-such-session");
    await expect(d.page.getByRole("alert")).toContainText("セッションが見つかりません");
    await expect(d.page.getByRole("button", { name: "もう一度接続する" })).toBeVisible();
    await d.context.close();
  });

  test("WebSocket が使えない回線でも、ポーリングに切り替わって参加・反映できる", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { id, code } = await createSession(adminDev.page, "WS不可会場");
    const host = await newDevice(browser, { signedIn: true, projector: true });
    await host.page.goto(`/#/session/host/${id}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();

    const phone = await newDevice(browser, { mobile: true });
    await phone.context.route("**/ws/**", (r) => r.abort()); // 社内ネットワーク等で WebSocket が遮断されている想定
    await phone.page.goto(`/#/portal/${code}`);
    await expect(phone.page.locator(".portal__session")).toContainText("WS不可会場");
    // ポーリングへ切り替わった後も、人数が反映される
    await expect(adminDev.page.getByTestId("people-card")).toContainText("参加者 1 人", { timeout: 40_000 });
    await adminDev.page.getByRole("button", { name: "ジャックポット: 結果" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-result");
    await expect(phone.page.locator(".portal__screen")).toHaveText("ジャックポット", { timeout: 40_000 });
    for (const d of [adminDev, host, phone]) await d.context.close();
  });

  test("スマホの画面幅で横スクロールが出ない(入室前・入室後)", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { code } = await createSession(adminDev.page, "スマホ表示会場");
    const phone = await newDevice(browser, { mobile: true });
    await phone.page.goto("/#/portal");
    await expect(phone.page.locator("#portal-code")).toBeVisible();
    const overflow = () => phone.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await phone.page.locator("#portal-code").fill(code);
    await phone.page.getByRole("button", { name: "参加する" }).click();
    await expect(phone.page.locator(".portal__session")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    // 押しやすさ: 参加ボタン/退出ボタンの高さが 28px 以上
    const box = await phone.page.getByRole("button", { name: "退出する" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(28);
    await adminDev.context.close();
    await phone.context.close();
  });

  test("ブラウザがオフラインになっても落ちず、復帰すると自動で再接続する", async ({ browser }) => {
    const adminDev = await newDevice(browser, { signedIn: true });
    const { code } = await createSession(adminDev.page, "オフライン会場");
    const phone = await newDevice(browser, { mobile: true });
    await phone.page.goto(`/#/portal/${code}`);
    await expect(phone.page.locator(".portal__session")).toBeVisible();

    await phone.context.setOffline(true);
    // 切断を検知して「再接続中」と表示する(画面は壊れず、セッション名は表示されたまま)
    await expect(phone.page.locator(".connection-banner")).toContainText("再接続中", { timeout: 90_000 });
    await expect(phone.page.locator(".portal__session")).toBeVisible();
    await phone.context.setOffline(false);
    await expect(phone.page.locator(".connection-banner")).toHaveText(/^接続中/, { timeout: 90_000 });
    await expect(phone.page.locator(".portal__session")).toBeVisible();
    await adminDev.context.close();
    await phone.context.close();
  });
});
