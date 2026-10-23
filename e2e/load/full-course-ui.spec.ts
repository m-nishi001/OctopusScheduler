import type { Browser } from "@playwright/test";
import { adminRpc, createSession, errors, expect, loginByQr, newDevice, nextButton, openAdvanced, openEventTab, publishPortal, route, sampleQuiz, seedStore, test } from "../ui/fixtures";
import type { Device } from "../ui/fixtures";
import { Metrics } from "./lib/metrics.mjs";
import { Participant, createRng } from "./lib/participant.mjs";
import { Operator } from "./lib/operators.mjs";
import { Crowd } from "./lib/crowd.mjs";
import { rpc } from "./lib/http.mjs";

/**
 * 負荷テスト(画面つき): 実ブラウザのホスト・管理・参加者3人と、合成の参加者47人 + 管理1台が、同じセッションに同時にいる状態で、
 * イベント開始 → エントリー → クイズ2問(選び直し・連打を含む)→ ジャックポット → エンディング → ロビー → 結果、を通す。
 * 合成の参加者は、画面のホストが公開する状態を見て反応する(protocol 版の full-course.mjs はホスト・管理も合成)。
 * 目的: 参加者50人・管理2人の負荷がかかっている最中でも、実際の画面が正しく動くことを確かめる。
 */

const SYNTHETIC = Number.parseInt(process.env.LOAD_SYNTHETIC ?? "47", 10);
const REAL = 3;
const runId = Date.now().toString(36).slice(-6);
const rng = createRng(Number.parseInt(process.env.LOAD_SEED ?? "20261018", 10));
const rand = (min: number, max: number) => min + rng() * (max - min);
const BASE = process.env.BASE ?? "http://127.0.0.1:8821";
const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN ?? "e2e-admin-session-token-0001";

const metrics = new Metrics();
const env = { base: BASE, metrics };
const PRIZES = Array.from({ length: 3 }, (_, i) => ({ id: `ld-p${i + 1}`, name: `景品${i + 1}`, order: i + 1, weight: 10 }));
const QUIZ_IDS = ["ldq1", "ldq2"];

const realIds = Array.from({ length: REAL }, (_, i) => `lu-${runId}-r${i + 1}`);
const synthIds = Array.from({ length: SYNTHETIC }, (_, i) => `lu-${runId}-${String(i + 1).padStart(2, "0")}`);
const allIds = [...realIds, ...synthIds];
const keys = new Map<string, string>();
const badResponses: string[] = [];

function watchResponses(d: Device, label: string) {
  d.page.on("response", (res) => {
    if (res.status() === 429 || res.status() >= 500) badResponses.push(`${label}: ${res.status()} ${res.url()}`);
  });
}

async function setupMembers(request: import("@playwright/test").APIRequestContext) {
  for (let i = 0; i < allIds.length; i += 10) {
    await Promise.all(
      allIds.slice(i, i + 10).map(async (id) => {
        await adminRpc(request, "accounts_addMember", { id, name: `負荷${id.slice(-2)}` });
        keys.set(id, (await adminRpc<{ key: string }>(request, "accounts_issueLoginKey", { id })).key);
      })
    );
  }
}

test("実ブラウザ(ホスト・管理・参加者3)+ 合成の参加者47・管理1: イベントを最後まで通す", async ({ browser, request }) => {
  test.setTimeout(20 * 60_000);
  await setupMembers(request);
  const sessionIds: string[] = [];
  const devices: Device[] = [];
  const crowdRef: { crowd: InstanceType<typeof Crowd> | null } = { crowd: null };
  const synth: InstanceType<typeof Participant>[] = [];
  let admin2: InstanceType<typeof Operator> | null = null;

  try {
    // ── 運営(実ブラウザ): セッション作成、ホスト起動、データ投入
    const admin = await newDevice(browser, { signedIn: true });
    devices.push(admin);
    watchResponses(admin, "admin");
    const { id: sessionId } = await createSession(admin.page, "負荷会場");
    sessionIds.push(sessionId);
    await seedStore(admin.page, "quiz-game", "QuizData", QUIZ_IDS.map((id) => ({ id, value: { ...sampleQuiz(id, 30), title: `負荷クイズ ${id}` } })));
    await admin.page.reload();
    const host = await newDevice(browser, { signedIn: true, projector: true });
    devices.push(host);
    watchResponses(host, "host");
    host.page.on("dialog", (d) => void d.dismiss());
    await host.page.goto(`/#/session/host/${sessionId}`);
    await expect(host.page.locator(".host-view__title")).toContainText("負荷会場");
    await seedStore(host.page, "quiz-game", "QuizData", QUIZ_IDS.map((id) => ({ id, value: { ...sampleQuiz(id, 30), title: `負荷クイズ ${id}` } })));
    await seedStore(host.page, "jackpot-game", "PrizeData", PRIZES.map((p) => ({ id: p.id, value: p })));
    await publishPortal(request, sessionId);

    // 管理者2人目(合成): 実際の管理端末と並行して、回答の一覧を取得する
    admin2 = new Operator(env, ADMIN_TOKEN, { role: "admin", label: "admin2", deviceId: `ld-ui-admin2-${runId}-01` });
    await admin2.join(sessionId);
    await admin2.connect();
    await expect(admin.page.getByTestId("host-card")).toContainText("ホスト接続中");

    // ── 参加者: 実ブラウザ3人 + 合成47人(一斉にログイン・入室・接続)
    const real = await Promise.all(realIds.map((id) => loginByQr(browser, id, keys.get(id)!)));
    for (const [i, d] of real.entries()) {
      devices.push(d);
      watchResponses(d, `real${i + 1}`);
    }
    synthIds.forEach((id, i) => {
      synth.push(new Participant(env, { index: REAL + i + 1, id, name: `負荷${id.slice(-2)}`, loginKey: keys.get(id)!, transport: i % 5 === 4 ? "poll" : "ws" }));
    });
    await Promise.all(
      synth.map(async (p) => {
        await p.login();
        await p.join();
        await p.connect();
      })
    );
    await expect(admin.page.getByTestId("host-card")).toContainText(`参加者 ${REAL + SYNTHETIC} 人`, { timeout: 60_000 });

    const getResults = (p: InstanceType<typeof Participant>) => rpc(env, "sessionHub_getResults", { sessionId }, p.token).then(() => undefined);
    const crowd = new Crowd(env, synth, { rand, profiles: ["spread", "storm"], onResults: getResults });
    crowdRef.crowd = crowd;
    crowd.start();

    // ── イベント開始とエントリー受付(管理端末の画面操作)。合成の参加者は受付が開いたのを見て一斉にエントリーする
    await openAdvanced(admin.page);
    await admin.page.getByTestId("event-title").fill("負荷試験イベント");
    await admin.page.getByRole("button", { name: "イベントを開始" }).click();
    await admin.page.getByRole("button", { name: "エントリー受付を開始" }).click();
    await expect(admin.page.getByTestId("pool-state")).toContainText("エントリーした人だけ");
    for (const [i, d] of real.entries()) {
      await expect(d.page.getByTestId("entry-button"), `real${i + 1}`).toBeVisible({ timeout: 30_000 });
      await d.page.getByTestId("entry-button").click();
      await expect(d.page.getByTestId("entry-done")).toBeVisible();
    }
    await expect(admin.page.getByTestId("entry-count")).toHaveText(`${REAL + SYNTHETIC}`, { timeout: 60_000 });
    await expect(real[0].page.getByTestId("entry-done")).toBeVisible();

    // ── クイズ2問
    const realChoice = new Map<string, Map<string, number>>();
    const playRound = async (quizId: string, index: number) => {
      await admin.page.getByTestId("quiz-select").selectOption(quizId);
      if (index === 0) {
        await openAdvanced(admin.page);
        await admin.page.getByTestId("advanced").getByRole("button", { name: "イントロ" }).click();
        await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${quizId}/intro`);
        for (const d of real) await openEventTab(d.page);
      } else {
        await admin.page.getByTestId("start-quiz").click();
        await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${quizId}/intro`);
      }
      await nextButton(admin.page).click(); // → エントリー画面(受付済みの人はそのまま)
      await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${quizId}/entry`);
      // エントリー人数の表示は、エントリー受付の回答ラウンドが現在のラウンドである間(最初のクイズの前)だけ確かめる
      // (サーバが同時に持てる回答ラウンドは1つなので、2問目以降の前は、直前のクイズの回答ラウンドが残っている)
      if (index === 0) await expect(host.page.getByTestId("stage-count")).toHaveText(`${REAL + SYNTHETIC}`, { timeout: 30_000 });
      await nextButton(admin.page).click(); // → 出題(回答受付が始まる。合成の参加者が一斉に反応する)
      await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${quizId}/play`);
      await expect(admin.page.getByTestId("now")).toContainText("回答受付中");
      // 出題の識別子(roundKey)は、ホストが公開した状態から合成の参加者が受け取ったもの
      await expect.poll(() => crowd.roundOrder[index] ?? "", { timeout: 30_000 }).not.toBe("");
      const roundKey = crowd.roundOrder[index];

      // 実ブラウザの参加者: 1人目は押し間違えて選び直す、2人目は1回、3人目は答えない
      const [p1, p2, p3] = real;
      await expect(p1.page.getByTestId("quiz-panel")).toContainText("みかんはどれ?", { timeout: 30_000 });
      await p1.page.getByRole("button", { name: /りんご/ }).click();
      await expect(p1.page.getByTestId("quiz-answered")).toContainText("1. りんご");
      await p1.page.getByRole("button", { name: /みかん/ }).click();
      await expect(p1.page.getByTestId("quiz-answered")).toContainText("2. みかん");
      await p2.page.getByRole("button", { name: /ぶどう/ }).click();
      await expect(p2.page.getByTestId("quiz-answered")).toContainText("3. ぶどう");
      realChoice.set(roundKey, new Map([[realIds[0], 2], [realIds[1], 3]]));

      // 合成の参加者の回答が出そろうまで待つ(締切までの余裕を見て)。運営の画面の回答数が増える
      expect(await crowd.idle(40_000), "合成の参加者の回答が時間内に終わらない").toBe(true);
      const expected = 2 + synth.filter((p) => p.finalResponse(roundKey)).length;
      await expect(admin.page.getByTestId("quiz-state")).toContainText(`回答 ${expected} 人`, { timeout: 30_000 });

      // 受付を締め切る(実際の管理端末の主ボタン)。管理者2人目も同時に締めても問題ない
      await Promise.all([nextButton(admin.page).click(), admin2!.closeRound(roundKey).catch(() => undefined)]);
      await expect(host.page.getByText("受付を終了しました")).toBeVisible();
      await expect(p3.page.getByTestId("quiz-closed")).toContainText("回答受付終了です!");
      await expect(p1.page.getByTestId("quiz-closed-answer")).toContainText("2. みかん");

      // 保存された回答を、実際に送った内容と突き合わせる(合成の参加者は最後の応答、実ブラウザは画面で選んだもの)
      const stored = await admin2!.getAnswers(roundKey);
      const byMember = new Map<string, { no: number; atMs: number }>(stored.answers.map((a: { memberId: string; no: number; atMs: number }) => [a.memberId, a]));
      expect(stored.answers.length).toBe(expected);
      for (const p of synth) {
        const last = p.finalResponse(roundKey);
        if (!last) continue;
        expect(byMember.get(p.id)?.no, `${p.label} の回答`).toBe(last.no);
        expect(byMember.get(p.id)?.atMs, `${p.label} の回答時刻`).toBe(last.atMs);
      }
      for (const [id, no] of realChoice.get(roundKey)!) expect(byMember.get(id)?.no, `実ブラウザ ${id} の回答`).toBe(no);
      expect(stored.round.answerRev).toBeGreaterThanOrEqual(stored.answers.length);

      // 正解発表 → 結果。正解(2番)を選んだ人が正解と出る
      await nextButton(admin.page).click();
      await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${quizId}/answer`);
      await expect(p1.page.getByTestId("quiz-verdict")).toHaveText("正解！");
      await expect(p2.page.getByTestId("quiz-verdict")).toContainText("残念");
      await expect(p3.page.getByTestId("quiz-panel")).toContainText("あなたは回答していません");
      await nextButton(admin.page).click();
      await expect.poll(() => route(host.page)).toBe(`/execute/quiz/${quizId}/result`);
      await expect(host.page.locator(".ranking-item").first()).toBeVisible({ timeout: 60_000 });
      await expect(host.page.locator(".ranking-item .rank-badge").first()).toHaveText("1", { timeout: 120_000 });
      // 結果の保存(R2)。順位発表が終わると、ホストが保存する
      type Rounds = { quiz: { rounds: Array<{ roundKey: string; answeredCount: number }> } };
      const savedRounds = async () => (await adminRpc<Rounds>(request, "sessionHub_getResults", { sessionId })).quiz.rounds.map((r) => `${r.roundKey}=${r.answeredCount}`);
      await expect.poll(savedRounds, { timeout: 90_000, message: "結果が保存されない" }).toContain(`${quizId}:live=${expected}`); // 結果の識別子は「クイズID:live」(回答の識別子には出題ごとの印が付く)
      // ロビーまで戻る(当選者がいれば景品の表示を経由する)。合成の参加者は結果を一斉に取得している
      for (let step = 0; step < 4 && (await route(host.page)) !== `/session/host/${sessionId}`; step++) {
        await nextButton(admin.page).click();
        await admin.page.waitForTimeout(1_500);
      }
      await expect.poll(() => route(host.page), { timeout: 30_000 }).toBe(`/session/host/${sessionId}`);
    };
    await playRound(QUIZ_IDS[0], 0);
    await playRound(QUIZ_IDS[1], 1);
    expect(await crowd.idle(30_000)).toBe(true);
    expect(crowd.resultsFetched.size, "結果を取得した合成の参加者").toBeGreaterThanOrEqual(SYNTHETIC - 1);

    // ── ジャックポット: エントリーした50人が対象。景品3つ。停止は当選者だけ(合成の当選者は自動で押す)
    await admin.page.getByRole("button", { name: "ジャックポット: 抽選" }).click();
    await expect.poll(() => route(host.page)).toBe("/execute/jackpot-draw");
    await expect(admin.page.getByTestId("jackpot-state")).toContainText("メンバー抽選", { timeout: 60_000 });
    for (const d of real) await openEventTab(d.page);
    const names = new Map(allIds.map((id) => [`負荷${id.slice(-2)}`, id]));
    const violations: string[] = [];
    let ended = false;
    for (let step = 0; step < 400 && !ended; step++) {
      if (await host.page.getByTestId("end-dialog").isVisible().catch(() => false)) {
        ended = true;
        break;
      }
      const state = await admin.page.getByTestId("jackpot-state").innerText();
      const now = await admin.page.getByTestId("now").innerText();
      const won = /当選者: (負荷\S+)/.exec(state);
      const winnerId = won ? names.get(won[1].trim()) : undefined;
      // 停止ボタンは、当選者以外の実ブラウザには出ない
      for (const [i, d] of real.entries()) {
        const visible = await d.page.getByRole("button", { name: "ルーレットを止める" }).isVisible().catch(() => false);
        if (visible && winnerId !== realIds[i]) violations.push(`step ${step}: real${i + 1} に停止ボタンが出ている(当選者: ${winnerId ?? "なし"})`);
      }
      const realWinner = real.findIndex((_, i) => realIds[i] === winnerId);
      if (realWinner >= 0 && (await real[realWinner].page.getByRole("button", { name: "ルーレットを止める" }).isVisible().catch(() => false))) {
        await real[realWinner].page.getByRole("button", { name: "ルーレットを止める" }).click({ timeout: 3_000 }).catch(() => undefined);
      } else if (/景品抽選/.test(now) && winnerId && !realIds.includes(winnerId)) {
        // 合成の当選者が自分で止めるのを少し待つ。止まらなければ管理端末の「次へ」で進める
        await admin.page.waitForTimeout(2_500);
        if (!(await host.page.getByTestId("end-dialog").isVisible().catch(() => false))) await nextButton(admin.page).click();
      } else {
        await nextButton(admin.page).click();
      }
      await admin.page.waitForTimeout(1_500);
    }
    expect(violations, violations.join("\n")).toEqual([]);
    expect(ended, "景品を使い切っても終了の画面が出ない(進行不能)").toBe(true);
    await admin.page.waitForTimeout(1_200);
    await nextButton(admin.page).click(); // 結果へ
    await expect.poll(() => route(host.page), { timeout: 30_000 }).toBe("/execute/jackpot-result");
    expect(crowd.stopAttempts.filter((a) => !a.ok && a.code === "FORBIDDEN"), "当選者本人の停止操作が拒否された").toEqual([]);

    // ── エンディング → 自動でロビーへ戻り、イベントが終わる
    await nextButton(admin.page).click(); // エンディングへ
    await expect.poll(() => route(host.page), { timeout: 90_000 }).toBe(`/session/host/${sessionId}`);
    for (const [i, d] of real.entries()) {
      await openEventTab(d.page);
      await expect(d.page.getByTestId("event-none"), `real${i + 1}`).toContainText("いまイベントは行われていません", { timeout: 30_000 });
    }
    // ポーリングの参加者は、次の取得(数秒後)で状態が消える
    await Promise.all(
      synth.map((p) =>
        p.session.waitFor((s) => s.data.event === undefined && s.data.jackpot === undefined, 20_000, "イベント終了の反映").catch(() => undefined)
      )
    );
    const lingering = synth.filter((p) => p.session.data.event !== undefined || p.session.data.jackpot !== undefined);
    expect(lingering.map((p) => p.label), "イベント終了後も状態が残っている合成の参加者").toEqual([]);

    // ── 結果タブ(実ブラウザ): クイズ2問の結果と、自分の正誤
    await real[0].page.getByRole("link", { name: "結果" }).click();
    await expect(real[0].page.getByTestId("results-round")).toHaveCount(2, { timeout: 30_000 });
    await expect(real[1].page.getByRole("link", { name: "結果" })).toBeVisible();
    await real[1].page.getByRole("link", { name: "結果" }).click();
    await expect(real[1].page.getByTestId("results-round-verdict").first()).toHaveText("不正解", { timeout: 30_000 });

    // ── 全体の判定
    expect(metrics.errors, JSON.stringify(metrics.errors.slice(0, 5))).toEqual([]);
    expect(badResponses, badResponses.slice(0, 5).join("\n")).toEqual([]);
    expect(errors, errors.slice(0, 5).join("\n")).toEqual([]);
  } finally {
    crowdRef.crowd?.stop();
    for (const p of synth) p.close();
    admin2?.close();
    for (const d of devices) await d.context.close().catch(() => undefined);
    for (const sessionId of sessionIds) await adminRpc(request, "sessionHub_closeSession", { sessionId }).catch(() => undefined);
    for (let i = 0; i < allIds.length; i += 10) {
      await Promise.all(allIds.slice(i, i + 10).map((id) => adminRpc(request, "accounts_deleteMember", { id }).catch(() => undefined)));
    }
  }
});
