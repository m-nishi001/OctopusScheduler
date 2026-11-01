import { adminRpc, createSession, expect, loginByQr, newDevice, nextButton, openAdvanced, openEventTab, route, seedJackpot, test, type Device } from "./fixtures";

/**
 * ジャックポットのエントリー画面。クイズと共通のエントリー画面で、抽選の対象が「エントリーした人のみ」のときだけオープニングの次に挟まる。
 *   - 既定の「参加者全員(自動)」: オープニングの次は説明(エントリー画面は挟まない)。「詳細な操作」から手動で開くと、
 *     管理者を除く、ポータルに入った人が自動でエントリー済みとして並ぶ(途中参加も増える)
 *   - 「エントリーした人のみ」に切り替えてからエントリー画面を開くと、その場で受付が始まり、エントリーした人だけが並ぶ・抽選される
 *   - 「説明へ」で受付が閉じ、説明画面の「まもなく抽選!」は未エントリーの人には出ない
 */
const PRIZES = ["特賞", "一等", "二等"].map((name, i) => ({ id: `jes-p${i + 1}`, name, order: i + 1, weight: 10 }));
const ids = { admin: "jes-adm", a: "jes-01", b: "jes-02", late: "jes-03" } as const;
const names = { admin: "受付管理者", a: "参加者01", b: "参加者02", late: "参加者03" } as const;
const keys = new Map<string, string>();
const sessionIds: string[] = [];

test.beforeAll(async ({ request }) => {
  for (const [who, id] of Object.entries(ids)) {
    await adminRpc(request, "accounts_addMember", { id, name: names[who as keyof typeof names] });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of Object.values(ids)) await adminRpc(request, "accounts_deleteMember", { id }).catch(() => undefined);
});

test("自動ではオープニングの次は説明(エントリー画面を挟まない) → 手動で開いたエントリー画面(自動: 管理者を除く参加者、途中参加も増える) → エントリーした人のみに切り替え → 説明で受付が閉じる → 抽選はエントリーした人だけ", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "エントリー画面");
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  await seedJackpot(host.page, { prizes: PRIZES });
  await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });
  const devices: Device[] = [admin, host];

  try {
    // 抽選の対象は既定で参加者全員(自動)なので、オープニングの次は説明(エントリー画面を挟まない)
    await admin.page.getByTestId("start-jackpot").click();
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-description");
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付は始まっていません");

    // 「詳細な操作」から手動でエントリー画面を開ける
    await openAdvanced(admin.page);
    await admin.page.getByRole("button", { name: "ジャックポット: エントリー" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-entry");
    await expect(admin.page.getByTestId("now")).toContainText("エントリー画面表示中");
    const hostLabel = host.page.getByTestId("stage-label");
    const hostCount = host.page.getByTestId("stage-count");
    const bubbleNames = () => host.page.locator('[data-testid="entry-bubble"] .bubble__name').allInnerTexts();
    await expect(hostLabel).toContainText("自動でエントリー");
    await expect(hostCount).toHaveText("0");
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付は始まっていません");
    await expect(nextButton(admin.page)).toHaveText(/説明へ/);

    // 管理者を除く、ポータルに入った人が自動でエントリー済みとして並ぶ
    // (受付QRは管理者には発行できないので、ポータルに入ったあとで管理者にして、管理者が参加者として入った状況にする)
    const adm = await loginByQr(browser, ids.admin, keys.get(ids.admin)!);
    devices.push(adm);
    await adminRpc(request, "accounts_updateMember", { id: ids.admin, name: names.admin, isAdmin: true });
    const a = await loginByQr(browser, ids.a, keys.get(ids.a)!);
    const b = await loginByQr(browser, ids.b, keys.get(ids.b)!);
    devices.push(a, b);
    await expect(hostCount).toHaveText("2", { timeout: 30_000 });
    await expect.poll(async () => (await bubbleNames()).sort(), { timeout: 30_000 }).toEqual([names.a, names.b]);
    await expect(a.page.getByTestId("entry-done")).toContainText("自動でエントリー済み ✓");

    // 途中参加の人も増える
    const late = await loginByQr(browser, ids.late, keys.get(ids.late)!);
    devices.push(late);
    await expect(hostCount).toHaveText("3", { timeout: 30_000 });
    await expect.poll(async () => (await bubbleNames()).sort(), { timeout: 30_000 }).toEqual([names.a, names.b, names.late]);

    // 「エントリーした人のみ」に切り替えると、その場で受付が始まり、エントリー画面も切り替わる
    await openAdvanced(admin.page);
    await admin.page.getByRole("button", { name: "エントリーした人だけに切り替える" }).click();
    await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人のみ");
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付中");
    await expect(hostLabel).toContainText("エントリー受付中");
    await expect(hostCount).toHaveText("0");
    await expect(a.page.getByTestId("entry-button")).toBeVisible();
    await expect(b.page.getByTestId("entry-button")).toBeVisible();

    // タップした人だけが並ぶ
    await b.page.getByTestId("entry-button").click();
    await expect(b.page.getByTestId("entry-done")).toContainText("エントリー済み ✓");
    await expect(hostCount).toHaveText("1", { timeout: 30_000 });
    await expect.poll(bubbleNames, { timeout: 30_000 }).toEqual([names.b]);

    // 次へ(説明へ): 受付が閉じる
    await expect(admin.page.getByTestId("now")).toContainText("エントリー画面表示中");
    await expect(nextButton(admin.page)).toHaveText(/説明へ/);
    await nextButton(admin.page).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-description");
    await expect(admin.page.getByTestId("now")).toContainText("説明表示中");
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付は終了");

    // 説明画面の「まもなく抽選!」は、エントリー済みの人にだけ出る
    await openEventTab(a.page);
    await openEventTab(b.page);
    await expect(b.page.getByTestId("jackpot-waiting-title")).toContainText("まもなく抽選");
    await expect(a.page.getByTestId("jackpot-waiting")).toHaveCount(0);
    await expect(a.page.getByTestId("entry-button")).toHaveCount(0); // 受付は終わっている

    // 抽選の対象はエントリーした人だけ
    await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
    let winner = "";
    for (let i = 0; i < 30 && !winner; i++) {
      const state = await admin.page.getByTestId("jackpot-state").innerText();
      const m = /当選者: (参加者\d\d)/.exec(state);
      if (m) {
        winner = m[1];
        break;
      }
      await nextButton(admin.page).click();
      await expect.poll(() => admin.page.getByTestId("jackpot-state").innerText(), { timeout: 10_000 }).not.toBe(state).catch(() => undefined);
      await admin.page.waitForTimeout(1500);
    }
    expect(winner).toBe(names.b);
  } finally {
    for (const d of devices) await d.context.close();
  }
});

test("エントリーした人のみでは、オープニングの次にエントリー画面が自動で出て(受付も始まる)、説明へ進むと受付が閉じる", async ({ browser }) => {
  test.setTimeout(180_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "エントリー画面(対象指定)");
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toBeVisible();
  try {
    // エントリー受付から始めたイベントの対象は「エントリーした人のみ」。そのままジャックポットを始める
    await admin.page.getByTestId("start-entry").click();
    await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人のみ");
    await admin.page.getByTestId("start-jackpot").click();
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-entry");
    await expect(admin.page.getByTestId("now")).toContainText("エントリー画面表示中");
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付中");
    await expect(nextButton(admin.page)).toHaveText(/説明へ/);
    await nextButton(admin.page).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-description");
    await expect(admin.page.getByTestId("entry-state")).toContainText("受付は終了");
  } finally {
    for (const d of [admin, host]) await d.context.close();
  }
});
