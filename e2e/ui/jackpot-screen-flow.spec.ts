import type { APIRequestContext, Browser } from "@playwright/test";
import { makeBadgePng, makeWav, TUNES } from "../../scripts/seed-content.js";
import { allStarts, installSoundTrace, soundTrace } from "./helpers/sound-trace";
import { pressMain } from "./helpers/jackpot-console";
import { adminRpc, createSession, demoDrawSetting, expect, isGas, loginByQr, newDevice, nextButton, openEventTab, publishPortal, route, seedJackpot, test, type Device } from "./fixtures";

/**
 * ジャックポットの画面の流れ: オープニング → 説明(1ページずつ) → デモ抽選(練習。既定 ON) → 本抽選。
 *   - デモ抽選 ON: 説明の最後の「次へ」でデモ抽選へ。本番と同じ画面を練習として回し、決めた回数で本抽選へ進む。
 *   - デモ抽選 OFF: 説明から本抽選へ直行する。
 *   - デモ抽選中、参加者のポータルには当選のお知らせ・止めるボタン・結果タブの変化が出ず、サーバーにも結果・確変の予定が残らない。
 *   - オープニングの行送り: 行数行ずつ上へ送られ、本文はエスケープして表示され、項目の始めに効果音が鳴る。
 */

const ids = ["jp-flow-01", "jp-flow-02", "jp-flow-03"];
const keys = new Map<string, string>();
const sessionIds: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  for (const id of ids) {
    await adminRpc(request, "accounts_addMember", { id, name: `流れ${id.slice(-2)}` });
    keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
  }
});

test.afterAll(async ({ request }) => {
  for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
  for (const id of ids) await adminRpc(request, "accounts_deleteMember", { id });
});

const PRIZES = ["特賞", "一等", "二等", "三等"].map((name, i) => ({ id: `jp-flow-p${i + 1}`, name, order: i + 1, rank: 3, animation: "roulette" }));

const setting = (screenName: string, settingName: string, value: unknown) => ({ screenName, settingName, settingValue: JSON.stringify(value) });

interface ServerState {
  plan: unknown | null;
  draws: Array<{ revealedAtMs: number | null }>;
}
const serverState = (request: APIRequestContext, sessionId: string) => adminRpc<ServerState>(request, "sessionHub_getJackpotState", { sessionId });

/** 管理・ホスト(投影)を開き、画面設定を入れる。参加者(`guestCount` 人)はポータルにログインする(抽選の対象は既定の「参加者全員(自動)」)。 */
async function scene(browser: Browser, request: APIRequestContext, label: string, demo: { enabled: boolean; rounds?: number }, guestCount = 0) {
  const admin = await newDevice(browser, { signedIn: true });
  const { id: sessionId } = await createSession(admin.page, label);
  sessionIds.push(sessionId);
  const host = await newDevice(browser, { signedIn: true, projector: true });
  host.page.on("dialog", (d) => void d.dismiss());
  await host.page.goto(`/#/session/host/${sessionId}`);
  await expect(host.page.locator(".host-view__title")).toContainText(label.slice(0, 4));
  await seedJackpot(host.page, {
    prizes: PRIZES,
    screens: [
      setting("opening", "opening-screen-settings", { bgm: "", items: [{ kind: "テキスト", text: "ようこそ", effect: "静止", seconds: 0.6 }] }),
      setting("description", "description-screen-settings", { bgm: "", pages: ["説明の1ページ目", "説明の2ページ目"].map((text) => ({ kind: "テキスト", text })) }),
      demoDrawSetting(demo.enabled, demo.rounds ?? 1),
    ],
  });
  await publishPortal(request, sessionId);
  await admin.page.getByTestId("start-jackpot").click();
  await expect(admin.page.getByTestId("pool-state")).toContainText("参加者全員(自動)");
  const guests: Device[] = [];
  for (const id of ids.slice(0, guestCount)) {
    const g = await loginByQr(browser, id, keys.get(id)!);
    await expect(g.page.getByTestId("entry-done")).toContainText("自動でエントリー済み ✓");
    guests.push(g);
  }
  return { admin, host, guests, sessionId };
}

/** 説明を1ページずつ最後まで進める(最後は「説明を終える」)。説明の画面と文面、管理端末の表示を確かめながら進む。 */
async function finishDescription(admin: Device, host: Device) {
  await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-description");
  await expect(host.page.getByTestId("description-text")).toHaveText("説明の1ページ目");
  await expect(admin.page.getByTestId("now")).toContainText("(1/2)");
  await expect(nextButton(admin.page)).toHaveText(/次のページへ \(2\/2\)/);
  await nextButton(admin.page).click();
  await expect(host.page.getByTestId("description-text")).toHaveText("説明の2ページ目");
  await expect(nextButton(admin.page)).toHaveText(/説明を終える/);
  await nextButton(admin.page).click();
}

test.describe("画面の流れ", () => {
  test("デモ抽選 ON(2回): 説明 → デモ抽選(練習の画面・2回目まで) → 本抽選。デモ中、ポータルに当選のお知らせ・止めるボタン・結果の変化が出ず、サーバーに結果も残らない", async ({ browser, request }) => {
    // GAS は1回ごとの通信が遅く、練習2回 + 本抽選1回を通すと数分かかる。時間で打ち切る(回数では打ち切らない)
    test.setTimeout(isGas ? 1_200_000 : 420_000);
    const deadline = Date.now() + (isGas ? 1_000_000 : 360_000);
    const { admin, host, guests, sessionId } = await scene(browser, request, "流れON会場", { enabled: true, rounds: 2 }, 3);
    await finishDescription(admin, host);

    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-demo-draw");
    await expect(host.page.getByTestId("demo-draw-badge")).toContainText("練習です");
    await expect(admin.page.getByTestId("now")).toContainText("デモ抽選");
    await expect(nextButton(admin.page)).toHaveText(/次へ/);
    for (const g of guests) await openEventTab(g.page);

    // 練習を「次へ」で進める。そのあいだずっと、参加者に当選のお知らせ・止めるボタンが出ず、結果タブの更新印も付かず、サーバーに結果も確変の予定も残らない
    let lastRound = "";
    for (let i = 0; Date.now() < deadline && (await route(host.page)) === "/execute/jackpot-demo-draw"; i++) {
      for (const g of guests) {
        await expect(g.page.getByTestId("you-won")).toHaveCount(0);
        await expect(g.page.getByRole("button", { name: "ルーレットを止める" })).toHaveCount(0);
        await expect(g.page.getByTestId("results-new")).toHaveCount(0);
        await expect(g.page.getByTestId("winner")).toHaveCount(0);
      }
      const state = await serverState(request, sessionId);
      expect(state.draws, "デモ抽選の結果はサーバーに残らない").toEqual([]);
      expect(state.plan, "デモ抽選の確変の予定はサーバーに残らない").toBeNull();
      const badge = await host.page.getByTestId("demo-draw-badge").innerText().catch(() => "");
      lastRound = /(\d)\/2回目/.exec(badge)?.[0] ?? lastRound;
      if ((await route(host.page)) === "/execute/jackpot-demo-draw") await pressMain(admin.page); // ホストが受け付けるのを待つ(固定の待ちを置かない)
    }
    expect(lastRound, "2回練習した").toBe("2/2回目");
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-draw");
    // 本抽選に入った時点で、公開された結果は無い(本抽選の1回目が確定されていても、まだ公開されていない)
    expect((await serverState(request, sessionId)).draws.filter((d) => d.revealedAtMs !== null)).toEqual([]);

    // 本抽選は従来どおり: 当選が確定・公開され、サーバーに残る(デモの当選者・景品は引き継がれない)
    await expect(host.page.getByTestId("demo-draw-badge")).toHaveCount(0);
    await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
    const revealed = async () => (await serverState(request, sessionId)).draws.filter((d) => d.revealedAtMs !== null).length;
    for (let i = 0; Date.now() < deadline && (await revealed()) < 1; i++) {
      await pressMain(admin.page);
    }
    expect(await revealed()).toBe(1);

    for (const d of [admin, host, ...guests]) await d.context.close();
  });

  test("デモ抽選 OFF: 説明の最後の「次へ」で、デモ抽選を経ずに本抽選へ直行する", async ({ browser, request }) => {
    test.setTimeout(180_000);
    const { admin, host } = await scene(browser, request, "流れOFF会場", { enabled: false });
    const visited: string[] = [];
    host.page.on("framenavigated", () => void route(host.page).then((r) => visited.push(r)).catch(() => undefined));
    await finishDescription(admin, host);
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(host.page.getByTestId("demo-draw-badge")).toHaveCount(0);
    expect(visited.filter((r) => r.includes("demo-draw"))).toEqual([]);
    for (const d of [admin, host]) await d.context.close();
  });

  test("デモ抽選 ON(1回): 説明の最後の「次へ」でデモ抽選へ、1回で本抽選へ進む", async ({ browser, request }) => {
    test.setTimeout(isGas ? 900_000 : 300_000);
    const deadline = Date.now() + (isGas ? 800_000 : 240_000);
    const { admin, host, guests } = await scene(browser, request, "流れ1回会場", { enabled: true, rounds: 1 }, 1);
    await finishDescription(admin, host);
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-demo-draw");
    for (let i = 0; Date.now() < deadline && (await route(host.page)) === "/execute/jackpot-demo-draw"; i++) {
      await pressMain(admin.page);
    }
    await expect.poll(() => route(host.page), { timeout: 60_000 }).toBe("/execute/jackpot-draw");
    for (const d of [admin, host, ...guests]) await d.context.close();
  });
});

test.describe("オープニングの行送り・画像・効果音(管理画面で作って再生)", () => {
  test("行送りで3行ずつ上へ送られ、途中に画像(フェード)が出て、項目の始めに効果音が鳴る。本文は文字として表示される", async ({ browser }) => {
    test.setTimeout(180_000);
    const dev = await newDevice(browser, { signedIn: true });
    const { page } = dev;
    // 音の再生を数える(<audio>・Web Audio のどちらで鳴らしても同じ形の記録器)。ヘッドレスでは音は聞こえないので、鳴らし始めた回数で確かめる
    await installSoundTrace(dev.context);
    const stamp = Date.now();
    const PIC = { name: `flow-${stamp}.png`, mimeType: "image/png", buffer: makeBadgePng("#10b981", "#064e3b", { width: 64, height: 64 }) };
    const SE = { name: `flow-se-${stamp}.wav`, mimeType: "audio/wav", buffer: makeWav(TUNES.prize) };
    const LINES = ["<b>一行目</b>", "二行目", "三行目", "四行目", "五行目", "六行目", "七行目"].join("\n");

    const save = page.getByRole("button", { name: "保存", exact: true });
    // 空の設定から始める(ほかのテストが同期したサーバーの設定を読まないように)
    await page.goto("/#/sessions");
    await seedJackpot(page, { demoDraw: true });
    await page.goto("/#/execute/jackpot-admin/screens/opening");
    await page.reload();
    await expect(save).toBeVisible();
    const dialog = page.getByRole("dialog");
    try {
      // 1) 7行の文章を、3行ずつ・1秒おきに送る
      await page.getByRole("button", { name: "追加", exact: true }).click();
      await dialog.getByTestId("entry-text").fill(LINES);
      await dialog.getByTestId("entry-effect").selectOption("行送り");
      await dialog.getByTestId("entry-seconds").fill("1");
      await dialog.getByTestId("entry-lines").fill("3");
      await dialog.getByRole("button", { name: "保存" }).click();
      // 2) 画像(フェード・1.5秒)+ 効果音
      await page.getByRole("button", { name: "追加", exact: true }).click();
      await dialog.getByTestId("entry-kind").selectOption("画像");
      await dialog.getByTestId("media-file").nth(0).setInputFiles(PIC);
      await dialog.getByTestId("entry-effect").selectOption("フェード");
      await dialog.getByTestId("entry-seconds").fill("1.5");
      await dialog.getByTestId("media-file").nth(1).setInputFiles(SE);
      await dialog.getByRole("button", { name: "保存" }).click();
      // 3) 続きの文章(静止・1秒)+ 効果音
      await page.getByRole("button", { name: "追加", exact: true }).click();
      await dialog.getByTestId("entry-text").fill("続きの文章");
      await dialog.getByTestId("entry-effect").selectOption("静止");
      await dialog.getByTestId("entry-seconds").fill("1");
      await dialog.getByTestId("media-file").nth(0).setInputFiles(SE);
      await dialog.getByRole("button", { name: "保存" }).click();
      await expect(page.getByTestId("entry-row")).toHaveCount(3);
      await save.click();
      await expect(page.getByText("保存しました")).toBeVisible();

      // 再生: 行送りの各ページ → 画像 → 続きの文章 → 説明へ
      await page.goto("/#/execute/jackpot-opening");
      const seen = { pages: new Set<string>(), indexes: new Set<string>(), windowLines: 0, escaped: false, imageShown: false };
      for (let i = 0; i < 300 && (await route(page)) === "/execute/jackpot-opening"; i++) {
        const item = page.getByTestId("seq-item");
        if (await item.count()) {
          const index = await item.getAttribute("data-index").catch(() => null);
          if (index !== null) seen.indexes.add(index);
          if ((await item.getAttribute("data-effect").catch(() => null)) === "行送り") {
            seen.pages.add((await item.getAttribute("data-page").catch(() => null)) ?? "");
            const m = await page
              .evaluate(() => {
                const win = document.querySelector(".seq-window") as HTMLElement | null;
                const text = document.querySelector('[data-testid="seq-text"]') as HTMLElement | null;
                if (!win || !text) return null;
                return { pages: Number(document.querySelector('[data-testid="seq-item"]')?.getAttribute("data-pages")), lines: win.clientHeight / parseFloat(getComputedStyle(text).lineHeight), bold: !!text.querySelector("b"), literal: text.textContent?.includes("<b>一行目</b>") ?? false };
              })
              .catch(() => null);
            if (m) {
              seen.windowLines = Math.round(m.lines);
              seen.escaped = m.literal && !m.bold;
              expect(m.pages).toBe(3);
            }
          }
          if (await page.getByTestId("seq-image").count()) seen.imageShown = true;
        }
        await page.waitForTimeout(100);
      }
      expect([...seen.pages].sort()).toEqual(["0", "1", "2"]); // 3ページ(3行・3行・1行)を順に出した
      expect(seen.windowLines, "窓の高さは3行ぶん").toBe(3);
      expect(seen.escaped, "本文は文字として出す(<b> は太字にならず、そのまま見える)").toBe(true);
      expect(seen.imageShown, "途中に画像が出た").toBe(true);
      expect([...seen.indexes].sort()).toEqual(["0", "1", "2"]);
      await expect.poll(() => route(page), { timeout: 30_000 }).toBe("/execute/jackpot-description");
      // 効果音は、項目2・項目3の始めに1回ずつ鳴った
      const plays = allStarts(await soundTrace(page));
      expect(plays.length).toBeGreaterThanOrEqual(2);
      expect(plays.filter((x) => x.loop), "効果音はループしない").toEqual([]);
    } finally {
      // 後始末: 項目を全部消して保存(ほかのテストが、この設定を読まないように)
      await page.goto("/#/execute/jackpot-admin/screens/opening");
      await expect(save).toBeVisible();
      for (let n = await page.getByTestId("entry-row").count(); n > 0; n--) await page.getByTestId("entry-row").first().getByRole("button", { name: "削除" }).click();
      await save.click();
      await expect(page.getByText("保存しました")).toBeVisible();
      await dev.context.close();
    }
  });
});
