import type { Page } from "@playwright/test";
import { makeBadgePng } from "../../scripts/seed-content.js";
import { adminRpc, createSession, expect, loginByQr, nextButton, newDevice, openAdvanced, openEventTab, route, seedJackpot, test } from "./fixtures";

/**
 * ジャックポットのメンバーの顔写真は、共通の名簿(Member.photo)から出る。ジャックポット独自の写真は持たない。
 *   - 管理 > メンバー: 一覧のサムネイルが名簿の写真。追加・編集ダイアログに写真のアップロード欄は無い
 *   - 管理 > メンバーの「CSVから取り込む」: ID をキーにした ランク・当選しやすさ(名簿にいない ID は、名前が無ければエラー)
 *   - メンバー抽選(ホストの画面)の各コマに名簿の写真が出て、回っている間に写真の通信が増えない
 *   - 結果の画面に、当選者の写真が出る
 * 参加者は別々のブラウザコンテキスト(= 別々のスマホ)。参加者・セッションは終わったら消す。
 * 撮影先(E2E_EVIDENCE_DIR)を指定すると、画面のスクリーンショットをそこへ保存する。
 */

const MEMBERS = 3;
const ids = Array.from({ length: MEMBERS }, (_, i) => `jp-photo-${i + 1}`);
const nameOf = (id: string) => `写真抽選${id.slice(-1)}`;
const names = ids.map(nameOf);
const keys = new Map<string, string>();
const sessionIds: string[] = [];
const evidenceDir = process.env.E2E_EVIDENCE_DIR;
const PRIZES = Array.from({ length: 4 }, (_, i) => ({ id: `jp-photo-p${i + 1}`, name: `景品${i + 1}`, order: i + 1, weight: 10 }));
/** 人ごとに色の違う写真(縮小後の想定の大きさ)。 */
const COLORS: Array<[string, string]> = [["#e11d48", "#1e3a8a"], ["#16a34a", "#365314"], ["#f59e0b", "#78350f"]];
const evidence = async (page: Page, name: string) => {
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/${name}.png` });
};

test.beforeAll(async ({ request }) => {
  for (const [i, id] of ids.entries()) {
    const png = makeBadgePng(COLORS[i][0], COLORS[i][1], { width: 256, height: 256 });
    // 写真は名簿の機能で付ける(画面の縮小は member-photo.spec.ts で確認済み)。ハッシュは中身から決まる
    const hash = (await import("node:crypto")).createHash("sha256").update(png).digest("hex").slice(0, 16);
    await adminRpc(request, "accounts_putMemberPhoto", { hash, dataUrl: `data:image/png;base64,${png.toString("base64")}` });
    await adminRpc(request, "accounts_addMember", { id, name: nameOf(id), photo: hash });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

test("管理 > メンバー: 名簿の写真が一覧に出て、編集に写真の欄は無い。CSV取込は ID をキーに rank / 当選しやすさを設定する", async ({ browser, request }) => {
  const admin = await newDevice(browser, { signedIn: true });
  await admin.page.goto("/#/jackpot-admin");
  const row = (id: string) => admin.page.getByRole("row").filter({ hasText: nameOf(id) });
  await expect(row(ids[0])).toBeVisible();
  for (const id of ids) await expect(row(id).locator("img.preview-img"), nameOf(id)).toBeVisible();
  await evidence(admin.page, "jackpot-admin-members-with-photos");

  await row(ids[0]).getByRole("button", { name: "詳細" }).click();
  const dialog = admin.page.getByRole("dialog");
  await expect(dialog.getByPlaceholder("メンバー名")).toHaveValue(nameOf(ids[0]));
  await expect(dialog.locator('input[type="file"]')).toHaveCount(0);
  await expect(dialog).toContainText("共通の名簿");
  await dialog.getByRole("button", { name: "キャンセル" }).click().catch(() => admin.page.keyboard.press("Escape"));
  await expect(dialog).toBeHidden();

  // CSVから取り込む: ID をキーにした ランク・当選しやすさ。名簿にいない ID は名前が無ければエラー(取り込めない)、名前があれば名簿に追加する
  await admin.page.getByTestId("table-import-open").click();
  const upload = admin.page.getByRole("dialog");
  const csv = `ID,名前,ランク,当選しやすさ\n${ids[0]},,2,77\n${ids[1]},,,5\njp-photo-ghost,,1,1\n`;
  await admin.page.getByTestId("table-import-table").setInputFiles({ name: "jackpot-members.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(admin.page.getByTestId("table-import-counts")).toContainText("更新 2 / 変更なし 0 / エラー 1");
  await expect(upload.locator('[data-testid="table-import-row"][data-status="error"]')).toContainText("名簿にない ID");
  await expect(upload.getByRole("button", { name: "取り込む" })).toBeDisabled();
  await admin.page.getByTestId("table-import-table").setInputFiles({
    name: "jackpot-members.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`ID,名前,ランク,当選しやすさ\n${ids[0]},,2,77\n${ids[1]},,,5\n`),
  });
  await expect(admin.page.getByTestId("table-import-counts")).toContainText("更新 2 / 変更なし 0 / エラー 0");
  await upload.getByRole("button", { name: "取り込む" }).click();
  await expect(admin.page.getByTestId("table-import-result")).toContainText("更新 2", { timeout: 60_000 });
  await admin.page.getByTestId("table-import-close").click();
  const roster = await adminRpc<Array<{ id: string }>>(request, "accounts_listMembers", {});
  expect(roster.some((m) => m.id === "jp-photo-ghost"), "名簿にいない ID のメンバーは作られない").toBe(false);
  await admin.page.reload();
  await expect(row(ids[0])).toContainText("77");
  await expect(row(ids[1])).toContainText("5");
  // 取込のあとも、写真は名簿のまま
  await expect(row(ids[0]).locator("img.preview-img")).toBeVisible();
  await admin.context.close();
});

test("メンバー抽選のコマと結果の画面に、名簿の写真が出る。回っている間は写真の通信を増やさない", async ({ browser, request }) => {
  test.setTimeout(420_000);
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, "写真抽選会場");
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  const photoRequests: number[] = [];
  const startedAt = Date.now();
  host.page.on("request", (r) => {
    if (r.url().endsWith("/rpc") && r.postDataJSON()?.name === "accounts_getMemberPhotos") photoRequests.push(Date.now() - startedAt);
  });
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toContainText("写真抽選会場");
  await seedJackpot(host.page, { prizes: PRIZES });
  await adminRpc(request, "sessionHub_setPortalSession", { sessionId, published: true });

  await openAdvanced(admin.page);
  await admin.page.getByTestId("event-title").fill("写真つき抽選会");
  await admin.page.getByRole("button", { name: "イベントを開始" }).click();
  await expect(admin.page.getByTestId("pool-state")).toContainText("参加者全員(自動)");
  const guests = await Promise.all(ids.map((id) => loginByQr(browser, id, keys.get(id)!)));
  for (const g of guests) await expect(g.page.getByTestId("entry-done")).toContainText("自動でエントリー済み ✓");

  await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
  await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
  await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
  for (const g of guests) await openEventTab(g.page);

  // メンバー抽選のコマ: すべて名簿の写真(代わりのアバターではない)
  const items = host.page.locator(".member-item img");
  await expect(items.first()).toBeVisible();
  await expect.poll(() => items.evaluateAll((els) => els.filter((e) => (e as HTMLImageElement).src.startsWith("data:image/png") || (e as HTMLImageElement).src.startsWith("data:image/webp")).length)).toBeGreaterThan(0);
  const defaults = await items.evaluateAll((els) => els.filter((e) => (e as HTMLImageElement).src.includes("image/svg+xml")).length);
  expect(defaults, "写真のあるメンバーが代わりのアバターで出ている").toBe(0);
  const decoded = await items.evaluateAll((els) => els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0));
  expect(decoded, "写真が読み込めていない").toBe(true);
  await evidence(host.page, "jackpot-member-draw-with-photos");
  // 回っている間(3秒)は、写真の通信が起きない(取得済みを使い回す)
  const before = photoRequests.length;
  await host.page.waitForTimeout(3000);
  expect(photoRequests.length, "アニメーション中に写真を取りに行っている").toBe(before);
  expect(photoRequests.length, "写真の取得は数回(まとめて取る)").toBeLessThanOrEqual(3);

  // 最後まで進めて結果の画面へ
  const stopButton = (i: number) => guests[i].page.getByRole("button", { name: "ルーレットを止める" });
  let ended = false;
  for (let step = 0; step < 300 && !ended; step++) {
    if (await host.page.getByTestId("end-dialog").isVisible().catch(() => false)) {
      ended = true;
      break;
    }
    const state = await admin.page.getByTestId("jackpot-state").innerText();
    const now = await admin.page.getByTestId("now").innerText();
    const won = /当選者: (写真抽選\d)/.exec(state);
    const winner = won ? names.indexOf(won[1]) : -1;
    if (winner >= 0 && (await stopButton(winner).isVisible().catch(() => false))) {
      await stopButton(winner).click({ timeout: 3000 }).catch(() => undefined);
    } else {
      const next = nextButton(admin.page);
      const label = (await next.innerText().catch(() => "")).trim();
      const phoneStops = winner >= 0 && /景品抽選/.test(now) && label.includes("止める");
      if (!phoneStops && (await next.isEnabled().catch(() => false))) await next.click();
    }
    await admin.page.waitForTimeout(1500);
  }
  expect(ended, "終了の画面が出ない").toBe(true);
  await expect(nextButton(admin.page)).toContainText("結果へ");
  await admin.page.waitForTimeout(1200);
  await nextButton(admin.page).click();
  await expect.poll(() => route(host.page), { timeout: 30_000 }).toBe("/execute/jackpot-result");

  // 結果の画面: 当選者の写真(頭文字のアバターではなく画像)
  const winnerPhotos = host.page.locator("img.winner-photo");
  await expect(winnerPhotos).toHaveCount(MEMBERS, { timeout: 30_000 });
  const ok = await winnerPhotos.evaluateAll((els) => els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0 && (e as HTMLImageElement).src.startsWith("data:image/")));
  expect(ok).toBe(true);
  await host.page.waitForTimeout(2500); // 結果の画面のフェードインが終わってから撮る
  await evidence(host.page, "jackpot-result-with-photos");

  for (const d of [admin, host, ...guests]) await d.context.close();
});
