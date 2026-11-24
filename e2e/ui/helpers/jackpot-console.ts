import type { Page } from "@playwright/test";
import { expect, nextButton } from "../fixtures";

/**
 * 管理コンソール(主ボタン)の操作。ジャックポットの抽選を、時間でなく「操作が受け付けられた」ことを待って進める。
 *
 * 主ボタンの「次へ」「止める」は、ホストに指示(advance)として届く。ホストは、演出の実行中・画面の準備前・終了画面の表示直後は
 * 指示を受け付けず捨てる(連打で当選画面を飛ばさないための仕様)。受け付けた指示は、ホストが公開する状態の ack が1増える。なので、
 *   - 押す前に、主ボタンが有効で「演出中」でない(押せる)ことを確かめ、
 *   - 押したあと、ack が増えるのを待ち(受け付けられた)、
 *   - 増えなければ(捨てられた)、押せる状態になるのを待って押し直す。
 * 固定の待ち時間(sleep)や、ホストの見た目(回っているか)には頼らない。
 */

/** ホストが受け付けた進行の操作の通し番号(公開状態の ack)。受け付けるたびに増え、捨てられた操作では増えない。 */
export async function ackOf(admin: Page): Promise<number> {
  return Number(await admin.getByTestId("jackpot-state").getAttribute("data-ack").catch(() => "0")) || 0;
}

/** 管理画面が見せている、主ボタンまわりの状態(文言・ヒント・いまの場面)。受け付けた指示で必ず変わる。 */
export async function consoleView(admin: Page): Promise<string> {
  const next = nextButton(admin);
  return [
    await next.innerText().catch(() => ""),
    await admin.getByTestId("next-hint").innerText().catch(() => ""),
    await admin.getByTestId("jackpot-state").innerText().catch(() => ""),
    await admin.getByTestId("now").innerText().catch(() => ""),
  ].join("|");
}

/**
 * 主ボタンを押し、ホストが受け付けるまで待つ。受け付けた印は、ホストが公開する ack(受け付けた操作の通し番号)が増えること
 * (終了画面の「結果へ」だけは、画面を離れるので ack を増やさず、管理画面の状態が変わること)。捨てられたら、押せる状態を待って押し直す。
 */
export async function pressMain(admin: Page, what = "主ボタン"): Promise<void> {
  const next = nextButton(admin);
  for (let attempt = 0; attempt < 8; attempt++) {
    await expect(next, `${what}が押せる状態になる`).toBeEnabled({ timeout: 60_000 });
    await expect(next).not.toContainText("演出中", { timeout: 60_000 });
    const before = await consoleView(admin);
    const ack = await ackOf(admin);
    // 終了画面の「結果へ」は、受け付けても ack を増やさず、画面を離れる(状態が変わる)
    const leaving = before.startsWith("結果へ");
    await next.click();
    try {
      await expect.poll(async () => (await ackOf(admin)) > ack || (leaving && (await consoleView(admin)) !== before), { timeout: 10_000 }).toBe(true);
      return;
    } catch {
      // ホストが指示を捨てた(演出の実行中・準備前など)。押せる状態になるのを待って、押し直す
    }
  }
  throw new Error(`${what}を押しても、ホストが受け付けなかった: ${await consoleView(admin)}`);
}

/** 管理コンソールの主ボタンが「止める」(指定の種類)になるまで、主ボタンを押して進める。 */
export async function advanceUntilStop(admin: Page, what: "メンバー" | "景品"): Promise<void> {
  const next = nextButton(admin);
  for (let i = 0; i < 40; i++) {
    await expect(next).not.toContainText("演出中", { timeout: 60_000 });
    const label = (await next.innerText().catch(() => "")).trim();
    const hint = (await admin.getByTestId("next-hint").innerText().catch(() => "")).trim();
    if (label.includes("止める") && hint.includes(what)) return;
    await pressMain(admin, "次へ");
  }
  throw new Error(`${what}を止められる状態にならなかった`);
}

/**
 * 「止める」を押す。押す直前に、主ボタンが有効な「止める」(指定の種類)であることを確かめる。
 * 「止める」はホストが回り始めてから公開される状態なので、ホストの見た目(回っているか)でなく、この状態を条件にする。
 */
export async function pressStop(admin: Page, what?: "メンバー" | "景品"): Promise<void> {
  const next = nextButton(admin);
  await expect(next).toContainText("止める", { timeout: 60_000 });
  if (what) await expect(admin.getByTestId("next-hint")).toContainText(what);
  await pressMain(admin, "止める");
}

/** 「止める」を押してから、管理端末の主ボタンの「演出中…」が消えるまでの時間(ミリ秒)。 */
export async function stopAndMeasure(admin: Page): Promise<number> {
  const next = nextButton(admin);
  await expect(next).toContainText("止める", { timeout: 60_000 });
  const clicked = Date.now();
  await pressMain(admin, "止める");
  await expect(next).not.toContainText("演出中", { timeout: 60_000 });
  return Date.now() - clicked;
}
