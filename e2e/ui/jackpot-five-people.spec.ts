import { adminRpc, createSession, expect, newDevice, nextButton, openAdvanced, openEventTab, route, seedStore, test } from "./fixtures";

/**
 * 5名構成(管理者1 + 参加者4)で、景品がメンバーより多いジャックポットを最後まで通す。
 * 実際の会で見つかった不具合の回帰テスト:
 *   1. 当選者の「あたりました!」が、景品抽選の画面に進んだら自動で閉じる(閉じるボタンを押さなくてよい)
 *   2. 景品抽選の停止ボタンは当選者のスマホにだけ出る(ほかの参加者は止められない)
 *   3. 景品 > メンバー でも、メンバーが尽きたら終了の画面が出て、操作を続けて結果の画面へ進める
 * 参加者は別々のブラウザコンテキスト(= 別々のスマホ)。参加者・セッションは終わったら消す。
 */

const MEMBERS = 4;
const ids = Array.from({ length: MEMBERS }, (_, i) => `jp-five-${i + 1}`);
const nameOf = (id: string) => `五人${id.slice(-1)}`;
const names = ids.map(nameOf);
const keys = new Map<string, string>();
const sessionIds: string[] = [];
/** メンバー(4人)より多い景品。 */
const PRIZES = Array.from({ length: 10 }, (_, i) => ({ id: `jp-five-p${i + 1}`, name: `景品${i + 1}`, order: i + 1, weight: 10 }));

const qrUrl = (id: string) => `/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(keys.get(id)!)}`;

test.beforeAll(async ({ request }) => {
  for (const id of ids) {
    await adminRpc(request, "accounts_addMember", { id, name: nameOf(id) });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

test("管理者+参加者4名・景品10件: 当選表示の自動クローズ、停止は当選者だけ、メンバーが尽きたら終了して結果へ", async ({ browser, request }) => {
  test.setTimeout(420_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "五人会場");
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toContainText("五人会場");
  await seedStore(host.page, "jackpot-game", "PrizeData", PRIZES.map((p) => ({ id: p.id, value: p })));
  await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });

  // イベントを始め、参加者4人全員がエントリーする(抽選の対象は、エントリーした人だけ)
  await openAdvanced(admin.page);
  await admin.page.getByTestId("event-title").fill("五人の抽選会");
  await admin.page.getByRole("button", { name: "イベントを開始" }).click();
  await admin.page.getByRole("button", { name: "エントリー受付を開始" }).click();
  await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人だけ");
  const guests = await Promise.all(ids.map(() => newDevice(browser, { mobile: true })));
  await Promise.all(guests.map((g, i) => g.page.goto(qrUrl(ids[i]))));
  for (const [i, g] of guests.entries()) {
    // ホームのエントリーカードで、1タップでエントリーが済む
    await expect(g.page.getByTestId("entry-button"), ids[i]).toBeVisible();
    await g.page.getByTestId("entry-button").click();
    await expect(g.page.getByTestId("entry-done")).toContainText("エントリー済み ✓");
  }
  await expect(admin.page.getByTestId("entry-count")).toHaveText(`${MEMBERS}`);

  await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
  await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
  for (const g of guests) await openEventTab(g.page);

  const stopButton = (i: number) => guests[i].page.getByRole("button", { name: "ルーレットを止める" });
  const overlay = (i: number) => guests[i].page.getByTestId("you-won");
  const winners = new Set<string>();
  const autoClosed = new Set<number>();
  const stoppedByWinner = new Set<number>();
  const violations: string[] = [];
  const overlaySeen = new Set<number>();

  let ended = false;
  for (let step = 0; step < 300 && !ended; step++) {
    if (await host.page.getByTestId("end-dialog").isVisible().catch(() => false)) {
      ended = true;
      break;
    }
    const state = await admin.page.getByTestId("jackpot-state").innerText();
    const now = await admin.page.getByTestId("now").innerText();
    const won = /当選者: (五人\d)/.exec(state);
    const winner = won ? names.indexOf(won[1]) : -1;
    if (won) winners.add(won[1]);

    // 停止ボタンは、当選者以外には一度も出ない
    for (let i = 0; i < MEMBERS; i++) {
      if (i !== winner && (await stopButton(i).isVisible().catch(() => false))) violations.push(`step ${step}: ${names[i]} に停止ボタンが出ている(当選者: ${won?.[1] ?? "なし"})`);
    }

    // 当選の全面表示は、景品抽選に進んだら、閉じるボタンを押さなくても消える
    if (winner >= 0) {
      if (await overlay(winner).isVisible().catch(() => false)) overlaySeen.add(winner);
      if (overlaySeen.has(winner) && /景品抽選/.test(now) && !autoClosed.has(winner)) {
        await expect(overlay(winner), `${names[winner]}: 景品抽選に進んでも当選の表示が閉じない`).toBeHidden({ timeout: 10_000 });
        autoClosed.add(winner);
      }
    }

    // 景品抽選の停止は、当選者のスマホから行う(出ていなければ管理端末の「次へ」で進める)
    if (winner >= 0 && (await stopButton(winner).isVisible().catch(() => false))) {
      // 見えた直後にホストが先へ進んでボタンが消えることがある(押した直後の古い表示など)。その場合は次の周回に任せる
      // (短い上限を付けないと、ボタンが再び現れるまで click が待ち続けて固まる)
      const clicked = await stopButton(winner).click({ timeout: 3000 }).then(() => true, () => false);
      if (clicked) stoppedByWinner.add(winner);
    } else {
      await nextButton(admin.page).click();
    }
    await admin.page.waitForTimeout(1500);
  }

  expect(violations, violations.join("\n")).toEqual([]);
  expect(ended, "メンバー4人が全員当選しても、終了の画面が出ない(進行不能)").toBe(true);
  expect(winners.size, "当選者が重複している/足りない").toBe(MEMBERS);
  expect(autoClosed.size, "当選表示の自動クローズを確認できた当選者の数").toBeGreaterThanOrEqual(1);
  expect(stoppedByWinner.size, "当選者のスマホから停止できた人数").toBeGreaterThanOrEqual(1);

  // 終了の理由はメンバー(景品が残っている)。管理端末の主ボタンは「結果へ」になり、押すと結果の画面へ進める
  await expect(host.page.getByTestId("end-dialog")).toHaveAttribute("data-reason", "members");
  await expect(host.page.getByTestId("end-message")).not.toContainText("すべての景品");
  await expect(admin.page.getByTestId("jackpot-state")).toContainText("抽選終了");
  await expect(nextButton(admin.page)).toContainText("結果へ");
  await admin.page.waitForTimeout(1200); // 終了の画面が出た直後は、連打で飛ばさない
  await nextButton(admin.page).click();
  await expect.poll(() => route(host.page), { timeout: 30_000 }).toBe("/execute/jackpot-result");

  for (const d of [admin, host, ...guests]) await d.context.close();
});
