import type { APIRequestContext } from "@playwright/test";
import { adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, openEventTab, route, seedStore, test } from "./fixtures";

/**
 * エントリー受付 → ジャックポットの抽選。エントリーした人だけが抽選の対象になる。
 * エントリー者を1人に絞ると当選者が決まるので、「対象外の人が当選しない」ことを決定的に確かめられる
 * （全メンバーから引いていれば、6人中5人は別の人が当選する）。
 * 参加者は別々のブラウザコンテキスト(= 別々のスマホ)。参加者・セッションは各テストの中で作り、終わったら消す。
 */

const ALL = 6;
const ids = Array.from({ length: ALL }, (_, i) => `jp-e2e-${String(i + 1).padStart(2, "0")}`);
const keys = new Map<string, string>();
const sessionIds: string[] = [];

const qrUrl = (id: string) => `/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(keys.get(id)!)}`;
const nameOf = (id: string) => `参加者${id.slice(-2)}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  // ジャックポットの名簿は、アカウントの名簿から取り込まれる（ホストを開く前に作っておく）
  for (const id of ids) {
    await adminRpc(request, "accounts_addMember", { id, name: nameOf(id) });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

const publish = (request: APIRequestContext, sessionId: string, published = true) =>
  adminRpc(request, "sessionHub_setPortalSession", { sessionId, published });

const PRIZES = ["特賞", "一等", "二等", "三等", "四等"].map((name, i) => ({ id: `jp-p${i + 1}`, name, order: i + 1, weight: 10 }));

/** 1回の抽選を最後まで進め、当選者の名前を返す（管理コンソールの「次へ」で進める）。 */
async function drawOnce(admin: import("@playwright/test").Page): Promise<string> {
  await openAdvanced(admin);
  await admin.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect(admin.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
  for (let i = 0; i < 30; i++) {
    const state = await admin.getByTestId("jackpot-state").innerText();
    const m = /当選者: (参加者\d\d)/.exec(state);
    if (m) return m[1];
    await nextButton(admin).click();
    // 通信が遅い環境(GAS)では、押した結果が表示に出るまで時間がかかる。出る前に重ねて押すと、当選者の表示を通り越して景品抽選まで進んでしまう
    await expect.poll(() => admin.getByTestId("jackpot-state").innerText(), { timeout: 10_000 }).not.toBe(state).catch(() => undefined);
    await admin.waitForTimeout(1500);
  }
  await expect(admin.getByTestId("jackpot-state")).toContainText(/当選者: 参加者\d\d/, { timeout: 60_000 });
  return /当選者: (参加者\d\d)/.exec(await admin.getByTestId("jackpot-state").innerText())![1];
}

async function scene(browser: import("@playwright/test").Browser, request: APIRequestContext, label: string, entrantIndexes: number[]) {
  test.setTimeout(240_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss()); // 想定外の alert で止まらないように
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toContainText(label);
  await seedStore(host.page, "jackpot-game", "PrizeData", PRIZES.map((p) => ({ id: p.id, value: p })));
  await publish(request, sessionId);

  await openAdvanced(admin.page);
  await admin.page.getByTestId("event-title").fill("ジャックポット抽選");
  await admin.page.getByRole("button", { name: "イベントを開始" }).click();
  await expect(admin.page.getByTestId("event-state")).toContainText("ジャックポット抽選");
  await admin.page.getByRole("button", { name: "エントリー受付を開始" }).click();
  await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人だけ");

  // 参加者が全員ログインし、決めた人だけがエントリーする
  const guests = await Promise.all(ids.map(() => newDevice(browser, { mobile: true })));
  await Promise.all(guests.map((g, i) => g.page.goto(qrUrl(ids[i]))));
  // ホームのカードに「エントリーする」が出ていて、1タップでエントリーが済む(別の画面へは移らない)
  for (const [i, g] of guests.entries()) await expect(g.page.getByTestId("entry-button"), ids[i]).toBeVisible();
  for (const i of entrantIndexes) {
    await guests[i].page.getByTestId("entry-button").click();
    await expect(guests[i].page.getByTestId("entry-done")).toContainText("エントリー済み ✓");
    await expect(guests[i].page).toHaveURL(/#\/p$/);
  }
  await expect(admin.page.getByTestId("entry-count")).toHaveText(`${entrantIndexes.length}`);
  await expect(admin.page.getByTestId("pool-state")).toContainText(`エントリーした人だけ(${entrantIndexes.length}人)`);
  return { admin, host, guests, sessionId };
}

test.describe("エントリー → ジャックポット", () => {
  test("エントリーした人だけが抽選の対象になり、エントリーしていない人は当選しない", async ({ browser, request }) => {
    const entrant = 3;
    const { admin, host, guests, sessionId } = await scene(browser, request, "抽選会場A", [entrant]);
    await admin.page.getByRole("button", { name: "エントリーを締め切る" }).click();
    await expect(admin.page.getByTestId("entry-state")).toContainText("エントリー受付は終了");

    const winner = await drawOnce(admin.page);
    expect(winner).toBe(nameOf(ids[entrant]));
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");

    // エントリー済みの当選者のスマホには「あたりました!」が全面に出る。ほかの人には当選者名が出て、演出は出ない
    const won = guests[entrant].page;
    await expect(won.getByTestId("you-won")).toBeVisible();
    await expect(won.getByTestId("you-won-name")).toContainText(winner);
    // 閉じるボタンは無い(景品抽選に進めば自動で消える)
    await expect(won.getByTestId("you-won").getByRole("button")).toHaveCount(0);
    await expect(won.getByTestId("you-won-close")).toHaveCount(0);
    // 紙吹雪は本当に動いている: animation が有効で、落下の時間が1枚ごとにばらける(無効な宣言だと 'none' のまま上に張り付く)
    const confetti = await won.locator(".pp-won__piece").evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return { name: cs.animationName, duration: cs.animationDuration, delay: cs.animationDelay };
      })
    );
    expect(confetti.length).toBeGreaterThan(0);
    for (const c of confetti) expect(c.name).toMatch(/^pp-won-fall/);
    expect(new Set(confetti.map((c) => c.duration)).size).toBeGreaterThan(1);
    expect(new Set(confetti.map((c) => c.delay)).size).toBeGreaterThan(1);

    const other = guests[(entrant + 1) % ALL].page;
    await openEventTab(other);
    await expect(other.getByTestId("winner-member")).toContainText(winner);
    await expect(other.getByTestId("reveal-burst-member")).toBeAttached(); // 当選者の公開で、弾ける演出が出る
    await expect(other.getByTestId("you-won")).toBeHidden();

    // 弾ける演出は、終わったあとに何も見える形で残らない(紙吹雪が名前の真ん中に積み重なって残る不具合の防止)
    const burst = other.getByTestId("reveal-burst-member");
    const pieces = await burst.locator(".pp-burst__piece").evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return { name: cs.animationName, distance: cs.getPropertyValue("--d").trim() };
      })
    );
    expect(pieces.length).toBe(18);
    for (const p of pieces) expect(p.name).toMatch(/^pp-burst-fly/);
    expect(new Set(pieces.map((p) => p.distance)).size).toBeGreaterThan(1); // 飛距離がばらける
    await expect
      .poll(
        () =>
          burst.evaluate((root) => {
            const opacities = [...root.querySelectorAll<HTMLElement>(".pp-burst__flash, .pp-burst__piece")].map((el) => getComputedStyle(el).opacity);
            const rays = root.querySelector<HTMLElement>(".pp-burst__rays");
            if (rays) opacities.push(getComputedStyle(rays, "::before").opacity);
            return opacities.every((o) => o === "0");
          }),
        { timeout: 10_000 }
      )
      .toBe(true);

    await publish(request, sessionId, false);
    for (const d of [admin, host, ...guests]) await d.context.close();
  });

  test("説明画面の「まもなく抽選!」は、エントリー済みの人にだけ出る。未エントリーの人にはエントリーのボタンが出て、1タップで同じ表示になる", async ({ browser, request }) => {
    const entrant = 1;
    const { admin, host, guests, sessionId } = await scene(browser, request, "抽選会場W", [entrant]);
    await admin.page.getByRole("button", { name: "ジャックポット: 説明" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-description");

    const entered = guests[entrant].page;
    const bystander = guests[0].page;
    await openEventTab(entered);
    await openEventTab(bystander);
    await expect(entered.getByTestId("jackpot-waiting-title")).toContainText("まもなく抽選");
    await expect(entered.getByTestId("entry-button")).toHaveCount(0);

    // 未エントリーの人には「まもなく抽選」を出さず、エントリーカードを出す
    await expect(bystander.getByTestId("entry-button")).toBeVisible();
    await expect(bystander.getByTestId("jackpot-waiting")).toHaveCount(0);

    // 受付中なので、1タップでエントリーでき、そのまま「まもなく抽選」に変わる(2回目のタップは要らない)
    await bystander.getByTestId("entry-button").click();
    await expect(bystander.getByTestId("jackpot-waiting-title")).toContainText("まもなく抽選");
    await expect(bystander.getByTestId("entry-button")).toHaveCount(0);

    await publish(request, sessionId, false);
    for (const d of [admin, host, ...guests]) await d.context.close();
  });

  test("別のエントリー者でも、そのエントリー者だけが当選する（締め切る前でも対象は最新）", async ({ browser, request }) => {
    const entrant = 1;
    const { admin, host, guests, sessionId } = await scene(browser, request, "抽選会場B", [entrant]);
    // 受付中のまま抽選する（対象は、その時点のエントリー者）
    const winner = await drawOnce(admin.page);
    expect(winner).toBe(nameOf(ids[entrant]));

    await publish(request, sessionId, false);
    for (const d of [admin, host, ...guests]) await d.context.close();
  });

  test("「全メンバー」に切り替えると、エントリーしていない人も抽選の対象になる（画面の表示が切り替わる）", async ({ browser, request }) => {
    const { admin, host, guests, sessionId } = await scene(browser, request, "抽選会場C", [0]);
    await admin.page.getByRole("button", { name: "全メンバーに切り替える" }).click();
    await expect(admin.page.getByTestId("pool-state")).toContainText("全メンバー");
    await admin.page.getByRole("button", { name: "エントリーした人だけに切り替える" }).click();
    await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人だけ(1人)");

    await publish(request, sessionId, false);
    for (const d of [admin, host, ...guests]) await d.context.close();
  });

  test("メンバー抽選では参加者のスマホに停止ボタンが出ず(管理端末が止める)、景品抽選では当選者のスマホだけから止められる", async ({ browser, request }) => {
    // エントリーした1人(ids[2])が必ず当選する。エントリーしていない人(ids[0])には、停止ボタンが一度も出ない。
    const { admin, host, guests, sessionId } = await scene(browser, request, "抽選会場D", [2]);
    const phone = guests[2];
    const bystander = guests[0];
    await openEventTab(phone.page);
    await openEventTab(bystander.page);
    const bystanderStop = bystander.page.getByRole("button", { name: "ルーレットを止める" });

    await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
    // まだ当選者は公開されない
    await expect(phone.page.getByTestId("winner")).toBeHidden();

    // メンバー抽選は管理端末だけが進行・停止する。スマホには停止ボタンが一度も出ない。
    // （名簿には他のテストが残したメンバーもいるので、当選者の名前は決め打ちしない）
    const stopBtn = phone.page.getByRole("button", { name: "ルーレットを止める" });
    for (let i = 0; i < 30; i++) {
      const state = await admin.page.getByTestId("jackpot-state").innerText();
      if (/当選者: [^—\s]\S*/.test(state)) break;
      await expect(stopBtn).toBeHidden();
      await expect(bystanderStop).toBeHidden();
      await nextButton(admin.page).click();
      await admin.page.waitForTimeout(1500);
    }
    await expect(admin.page.getByTestId("jackpot-state")).toContainText(/当選者: [^—\s]\S*/, { timeout: 60_000 });
    await expect(phone.page.getByTestId("winner")).toContainText(nameOf(ids[2]));

    // 景品抽選では、止められる場面で当選者のスマホにだけ停止ボタンが出る → 当選者のスマホで止める
    // (当選者の「あたりました!」は、景品抽選に進めば自動で閉じるので、閉じる操作は要らない)
    let phoneStopped = false;
    for (let i = 0; i < 30 && !phoneStopped; i++) {
      await expect(bystanderStop).toBeHidden();
      if (await stopBtn.isVisible().catch(() => false)) {
        await stopBtn.click();
        phoneStopped = true;
      } else {
        await nextButton(admin.page).click();
      }
      await admin.page.waitForTimeout(1500);
    }
    expect(phoneStopped).toBe(true);

    // 当選者と賞品の両方が画面に見えた後に、結果がサーバー(R2)へ保存される(参加者ポータルの「当選履歴」の元データ)。
    // 演出の途中では保存されない(ネタバレ防止)ので、賞品まで「次へ」で進める。
    type Results = { jackpot: { draws: Array<{ prizeName: string; memberName: string }> } };
    const drawsSaved = async () => (await adminRpc<Results>(request, "sessionHub_getResults", { sessionId })).jackpot.draws;
    for (let i = 0; i < 30 && (await drawsSaved()).length === 0; i++) {
      await nextButton(admin.page).click();
      await admin.page.waitForTimeout(1500);
    }
    const saved = await drawsSaved();
    expect(saved.length).toBeGreaterThanOrEqual(1);
    expect(saved[0].prizeName).toBeTruthy();
    expect(saved[0].memberName).toBeTruthy();

    await publish(request, sessionId, false);
    for (const d of [admin, host, ...guests]) await d.context.close();
  });
});
