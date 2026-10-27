import { adminRpc, createSession, expect, joinPortalAs, newDevice, nextButton, openAdvanced, seedStore, test } from "./fixtures";
import { captureTimeline, expectAnimating } from "./helpers/motion";
import type { Page } from "@playwright/test";
import { expectNoGapUnderReels, expectSlotFitsEverySize, expectSlotLarge, observeSlotStop, sampleRepeatedRows, stoppedWinRows } from "./helpers/slot";

/**
 * 景品抽選（ルーレット / スロット）が、開始で回り始め、停止で止まること。
 * 以前、スロットは開始しても何も動かない不具合があった（親から startSpin/stopSpin が見えなかった）。
 * 回転は画面の見た目で確認する: 回転中はスクリーンショットが毎回変わり、止めると回転が終わって当選が発表される。
 */

/** スロットの高さが窓の高さに占める割合(窓の大きさを変えた直後は、組み直されるまで 1 を超える)。 */
const slotHeightRatio = (page: Page) => () =>
  page.evaluate(() => document.querySelector(".slot-container")!.getBoundingClientRect().height / window.innerHeight);

const MEMBER = { id: "jp-draw-e2e-01", name: "抽選太郎" };
const sessionIds: string[] = [];
let memberKey = "";

test.beforeAll(async ({ request }) => {
  await adminRpc(request, "accounts_addMember", MEMBER);
  memberKey = (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id: MEMBER.id })).key;
});
test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  await adminRpc(request, "accounts_deleteMember", { id: MEMBER.id });
});

for (const kind of ["roulette", "slot"] as const) {
  test(`@motion 景品抽選(${kind}): 開始で回り始め、停止で止まる`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const admin = await newDevice(browser, { signedIn: true });
    const { id: sessionId } = await createSession(admin.page, `景品抽選-${kind}`);
    sessionIds.push(sessionId);
    const host = await newDevice(browser, { signedIn: true, projector: true });
    host.page.on("dialog", (d) => void d.dismiss());
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toBeVisible();
    const prizes = ["特賞", "一等", "二等", "三等", "四等"].map((name, i) => ({
      id: `jp-draw-${kind}-${i + 1}`,
      name,
      order: i + 1,
      weight: 10,
      animation: kind,
    }));
    await seedStore(host.page, "jackpot-game", "PrizeData", prizes.map((p) => ({ id: p.id, value: p })));

    // 抽選の対象は既定で「参加者全員(自動)」: ポータルから入室した人を1人用意する
    const guest = await joinPortalAs(browser, request, sessionId, MEMBER.id, memberKey);
    await openAdvanced(admin.page);
    await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
    const state = admin.page.getByTestId("jackpot-state");
    await expect(state).toContainText("メンバー抽選", { timeout: 60_000 });
    const next = nextButton(admin.page);

    // 景品抽選の画面になるまで「次へ」で進める
    const reel = host.page.locator(kind === "slot" ? ".slot-container" : ".roulette-container");
    for (let i = 0; i < 30 && !(await reel.isVisible().catch(() => false)); i++) {
      await next.click();
      await admin.page.waitForTimeout(1500);
    }
    await expect(reel).toBeVisible();

    // 回り始めるまで進める（開始の直前に「待機」の手順があるため、1回で始まるとは限らない）
    const spinning = host.page.locator(`${kind === "slot" ? ".slot-container" : ".roulette-container"}.spinning`);
    for (let i = 0; i < 5 && !(await spinning.isVisible().catch(() => false)); i++) {
      await next.click();
      await admin.page.waitForTimeout(1500);
    }
    await expect(spinning, "「次へ」を押しても景品抽選が回り始めない").toBeVisible();
    await expectAnimating(reel, `prize-${kind}-spinning`, { count: 4, intervalMs: 400 });

    if (kind === "slot") {
      // 遠くからでも読めるよう、ルーレット並みに画面を使う(1080p でも 720p でも。窓の大きさを変えると組み直される)
      await expectSlotLarge(host.page, "1920x1080", { heightRatio: 0.62, font: 58 });
      await host.page.setViewportSize({ width: 1280, height: 720 });
      await expect.poll(slotHeightRatio(host.page), "窓の大きさに合わせて組み直される").toBeLessThan(0.9);
      await expectSlotLarge(host.page, "1280x720", { heightRatio: 0.62, font: 38 });
      await expectSlotFitsEverySize(host.page, "スロット");
      // 枠の中に、リールの下の空白が無い(上下左右の余白が同じ)。どの大きさでも
      for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 }]) {
        await host.page.setViewportSize(size);
        await expect.poll(slotHeightRatio(host.page), "窓の大きさに合わせて組み直される").toBeLessThan(0.9);
        await expectNoGapUnderReels(host.page, `${size.width}x${size.height}`);
      }
      await host.page.setViewportSize({ width: 1920, height: 1080 });
      await expect.poll(slotHeightRatio(host.page), "窓の大きさに合わせて組み直される").toBeLessThan(0.9);

      // 回転中、窓に見える景品が同じ名前で続かない(当選を推測できない)
      expect(await sampleRepeatedRows(host.page, 180), "回転中に同じ景品名が続けて見えた").toEqual([]);

      // 回転中、どのリールも窓(3マス)が帯の外(黒)を映さない(以前は1周の継ぎ目で黒が見えた)
      const violations = await host.page.evaluate(async () => {
        const out: string[] = [];
        for (let i = 0; i < 120; i++) {
          document.querySelectorAll<HTMLElement>(".slot-container .reel").forEach((reel, r) => {
            const content = reel.querySelector<HTMLElement>(".reel-content")!;
            const rows = content.querySelectorAll<HTMLElement>(".prize-item");
            const rowH = rows[0].getBoundingClientRect().height;
            const top = reel.getBoundingClientRect().top;
            const bottom = rows[rows.length - 1].getBoundingClientRect().bottom;
            // 窓は枠線の内側(clientHeight)。枠線ぶんを含めると、帯の末尾ちょうどで止まる瞬間に誤検出する
            const windowBottom = top + reel.clientTop + reel.clientHeight;
            if (bottom + 1 < windowBottom) out.push(`frame ${i} reel ${r}: 帯の末尾(${bottom})が窓の下端(${windowBottom})より上 rowH=${rowH}`);
          });
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return out;
      });
      expect(violations, "回転中にリールの窓が帯の外を映した").toEqual([]);
    }

    // 止める → 回転が止まり、当選した景品が発表される（発表の紙吹雪は動き続けるので、静止ではなく発表の表示で確認する）
    const observed = kind === "slot" ? await observeSlotStop(host.page) : null;
    await next.click();
    await expect(spinning).toBeHidden({ timeout: 30_000 });
    // スロットは、3本とも同じ景品(当選景品)で、当たりの行(真ん中)に止まり、発表される景品と一致する
    const stoppedRows = kind === "slot" ? await stoppedWinRows(host.page) : [];
    if (observed) {
      // 止まり方: 左 → 中 → 右の順に止まり、最後のリールが止まるまでが設定(既定4秒)の前後25%。止まったあと、結果を見せる間は当たりの行が光る
      const o = await observed();
      expect(o.decelStartMs, "減速の始まりが見つからない").not.toBeNull();
      const [l, m, r] = o.landedAt;
      expect([l, m, r].every((x) => x !== null), `3本とも止まる: ${JSON.stringify(o.landedAt)}`).toBe(true);
      expect(l!, `左 → 中の順に止まる: ${JSON.stringify(o.landedAt)}`).toBeLessThan(m!);
      expect(m!, `中 → 右の順に止まる: ${JSON.stringify(o.landedAt)}`).toBeLessThan(r!);
      const total = r! - o.decelStartMs!;
      expect(total, `停止から最後のリールが止まるまで ${Math.round(total)}ms (設定 4000ms ±25%)`).toBeGreaterThan(3000);
      expect(total).toBeLessThan(5000);
      // 左が止まって(跳ね返りも終わって)いる間も、右は動いている
      const at = (t: number) => o.samples.find((s) => s.t >= t)!;
      const a = at(l! + 500);
      const b = at(l! + 600);
      expect(Math.abs(b.pos[0] - a.pos[0]), "左のリールは止まっている").toBeLessThan(0.5);
      expect(Math.abs(b.pos[2] - a.pos[2]), "右のリールはまだ動いている").toBeGreaterThan(1);
      const held = o.samples.filter((s) => s.t >= r! && s.t <= r! + 1500);
      expect(held.length).toBeGreaterThan(10);
      expect(held.every((s) => s.hit), "全部止まったあと、結果を見せる間は当たりの行が光る(hit)").toBe(true);
      expect(o.samples.filter((s) => s.t < r! - 50).every((s) => !s.hit), "止まる前は光らない").toBe(true);
    }
    await expect(host.page.getByText("景品当選")).toBeVisible({ timeout: 30_000 });
    if (kind === "slot") {
      expect(new Set(stoppedRows).size, `3本のリールが同じ景品で止まる: ${stoppedRows.join(",")}`).toBe(1);
      await expect(host.page.getByTestId("prize-winning-name")).toHaveText(stoppedRows[0]);
    }
    await captureTimeline(host.page, `prize-${kind}-stopped`, { count: 2, intervalMs: 500 });

    for (const d of [admin, host, guest]) await d.context.close();
  });
}
