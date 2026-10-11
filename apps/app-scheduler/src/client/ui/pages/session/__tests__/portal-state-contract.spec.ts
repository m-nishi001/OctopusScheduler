import { describe, expect, it } from "vitest";
import { clientInputLabel, readJackpotView, readQuizView } from "@octopus/participant-portal";
// ゲームのパッケージ全体（画面を含む）は読み込まず、公開する状態を作る関数だけを直接読む
import { buildQuizHostState } from "../../../../../../../../packages/game-quiz/src/client/model/quiz-host-state";
import { JACKPOT_STOP_COMMAND, RevealTracker, buildJackpotHostState } from "../../../../../../../../packages/game-jackpot/src/client/model/jackpot-host-state";

/**
 * 契約テスト: ゲームのホストが公開する状態の形と、参加者ポータルが読む形が合っていること。
 * ポータルはゲームに依存せず、形を検証して読むので、どちらかの形を変えたときにここで気づけるようにする。
 * 実際のやりとりと同じく、JSON を通して（シリアライズして）確かめる。
 */
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const OPTIONS = [
  { no: 1, text: "りんご", color: "#ef4444" },
  { no: 2, text: "みかん", color: "#f59e0b" },
];

describe("クイズ: ホストの公開 → ポータルの読み取り", () => {
  const base = { quizId: "qz1", title: "果物クイズ", question: "みかんはどれ?", options: OPTIONS };

  it("出題中: 問題・選択肢・締切・回答ラウンドのキーが読める。正解はまだ入らない", () => {
    const state = buildQuizHostState({ ...base, page: "play", phase: "answering", roundKey: "qz1:live", deadlineMs: 1_700_000_030_000, correctNo: 2 });
    const view = readQuizView({ quiz: wire(state) });
    expect(view).toEqual({
      page: "play",
      title: "果物クイズ",
      roundKey: "qz1:live",
      deadlineMs: 1_700_000_030_000,
      phase: "answering",
      question: "みかんはどれ?",
      options: OPTIONS,
      correctNo: null,
    });
  });

  it("正解発表: 正解の番号が入り、締切は入らない", () => {
    const state = buildQuizHostState({ ...base, page: "answer", phase: "closed", roundKey: "qz1:live", deadlineMs: 123, correctNo: 2 });
    const view = readQuizView({ quiz: wire(state) });
    expect(view).toMatchObject({ page: "answer", phase: "closed", deadlineMs: null, correctNo: 2, question: "みかんはどれ?" });
    expect(view?.options).toEqual(OPTIONS);
  });

  it.each(["intro", "qr", "result"] as const)("%s: 問題文・選択肢は公開されない（先に問題を渡さない）", (page) => {
    const state = buildQuizHostState({ ...base, page, phase: "idle", correctNo: page === "result" ? 2 : null });
    const view = readQuizView({ quiz: wire(state) });
    expect(view?.page).toBe(page);
    expect(view?.question).toBeNull();
    expect(view?.options).toEqual([]);
  });

  it("全ページ・全状態でポータルが読み取れる（null にならない）", () => {
    for (const page of ["intro", "qr", "play", "answer", "result"] as const) {
      for (const phase of ["idle", "answering", "closed"] as const) {
        const state = buildQuizHostState({ ...base, page, phase, roundKey: "qz1:live", deadlineMs: 1, correctNo: 1 });
        expect(readQuizView({ quiz: wire(state) }), `${page}/${phase}`).not.toBeNull();
      }
    }
  });
});

describe("ジャックポット: ホストの公開 → ポータルの読み取り", () => {
  it("停止演出の前は当選者・賞品が入らず、後に入る", () => {
    const tracker = new RevealTracker();
    const hidden = buildJackpotHostState({ phase: "member", nextLabel: "stopMemberDraw", tracker, memberName: "太郎", prizeName: "特賞" });
    expect(readJackpotView({ jackpot: wire(hidden) })).toEqual({ phase: "member", member: null, prize: null });

    tracker.onAction("stopMemberDraw");
    tracker.onAction("stopPrizeDraw");
    const shown = buildJackpotHostState({ phase: "prize", nextLabel: undefined, tracker, memberName: "太郎", prizeName: "特賞" });
    expect(readJackpotView({ jackpot: wire(shown) })).toEqual({ phase: "prize", member: "太郎", prize: "特賞" });
  });

  it("参加者に許可する操作のキーに、ポータルの表示名がある", () => {
    expect(JACKPOT_STOP_COMMAND).toBe("jackpot.stopRoulette");
    expect(clientInputLabel(JACKPOT_STOP_COMMAND)).toBe("ルーレットを止める");
  });
});
