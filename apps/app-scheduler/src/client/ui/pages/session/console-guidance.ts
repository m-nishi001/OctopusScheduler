/**
 * コントロール画面の「いま何が起きているか」と「主ボタンを押すと何が起きるか」を、
 * ホストの公開状態から導く(画面の文言をここ1か所に集め、状態ごとにテストで固定する)。
 *
 * 主ボタンは常に1つ。進行中のゲームに合わせて中身が変わり、押した結果を1行で予告する。
 */

export interface JackpotProgress {
  /** 公開している画面("description" = 説明のスライド)。抽選画面の状態では未設定のことがある。 */
  page?: string;
  /** 説明画面: 表示中のスライド(-1 = 導入画面)と枚数。 */
  index?: number;
  total?: number;
  phase: string;
  canStop: boolean;
  member: string | null;
  prize: string | null;
}

export interface QuizProgress {
  page: string;
  phase: string;
  title?: string;
}

export interface GuidanceInput {
  /** ホストが今映している画面のパス(ロビーなら /session/host/..)。 */
  hostPath: string;
  jackpot: JackpotProgress | null;
  quiz: QuizProgress | null;
  /** 回答受付中の回答数(クイズ)。 */
  answerCount: number | null;
  hostOnline: boolean;
  /** デモ(リハーサル)なら遷移先に ?demo=1 を付ける。 */
  demo: boolean;
}

/** 主ボタンの動作。advance=ホストの「次へ」、closeAnswers=受付の締切、navigate=ホストの画面を切り替える。 */
export type MainAction =
  | { kind: "advance" }
  | { kind: "closeAnswers" }
  | { kind: "navigate"; path: string };

export interface Guidance {
  game: "quiz" | "jackpot" | null;
  /** 「いま」の1行。 */
  now: string;
  /** 主ボタン。押せる操作が無い(ホスト不在・準備中)ときは null。 */
  main: { label: string; hint: string; action: MainAction } | null;
  /** 副ボタン「前へ」(説明のスライドを戻す)。戻れるときだけ。 */
  back?: { label: string; hint: string } | null;
}

const withDemo = (path: string, demo: boolean): string => (demo ? `${path}?demo=1` : path);

/** ジャックポットの画面の並び。主ボタンで順に進める(抽選画面の中は「次へ」で進む)。 */
const JACKPOT_FLOW: Record<string, { now: string; label: string; hint: string; to: string }> = {
  "/jackpot-opening": { now: "ジャックポット: オープニング表示中", label: "説明へ", hint: "ルールの説明画面を映します", to: "/jackpot-description" },
  "/jackpot-description": { now: "ジャックポット: 説明表示中", label: "抽選を始める", hint: "抽選の画面を映します(まだ抽選は始まりません)", to: "/jackpot-draw" },
  "/jackpot-result": { now: "ジャックポット: 結果表示中", label: "エンディングへ", hint: "エンディング画面を映します", to: "/jackpot-ending" },
};

function jackpotPage(path: string): string | null {
  const m = /^\/(?:execute\/)?(jackpot-[a-z]+)$/.exec(path);
  return m ? `/${m[1]}` : null;
}

function quizPage(path: string): string | null {
  const m = /^\/(?:execute\/)?quiz\/[^/]+\/(intro|entry|play|answer|result)$/.exec(path);
  return m ? m[1] : null;
}

function describeQuiz(input: GuidanceInput, page: string): Guidance {
  const title = input.quiz?.title ? `「${input.quiz.title}」` : "";
  const phase = input.quiz?.phase ?? "idle";
  const advance = (label: string, hint: string): Guidance["main"] => ({ label, hint, action: { kind: "advance" } });
  switch (page) {
    case "intro":
      return { game: "quiz", now: `クイズ${title}: イントロ表示中`, main: advance("次へ", "エントリー受付を始め、エントリーした人数を映します") };
    case "entry":
      return {
        game: "quiz",
        now: `クイズ${title}: エントリー受付中`,
        main: advance("次へ", "エントリーを締め切り、問題を映して、参加者の回答受付を始めます"),
      };
    case "play":
      if (phase === "answering") {
        const n = input.answerCount === null ? "" : ` ・ 回答 ${input.answerCount} 人`;
        return {
          game: "quiz",
          now: `クイズ${title}: 回答受付中${n}`,
          main: { label: "受付を締め切る", hint: "回答を締め切ります(制限時間が来ても自動で締め切られます)", action: { kind: "closeAnswers" } },
        };
      }
      if (phase === "closed") return { game: "quiz", now: `クイズ${title}: 受付終了`, main: advance("次へ", "正解を発表します") };
      return { game: "quiz", now: `クイズ${title}: 出題を準備中`, main: null };
    case "answer":
      return { game: "quiz", now: `クイズ${title}: 正解発表中`, main: advance("次へ", "結果(ランキング)を発表します") };
    default:
      return {
        game: "quiz",
        now: `クイズ${title}: 結果発表中`,
        main: advance("次へ", "順位の発表が終わったあと押すと、当選者がいれば景品を、いなければロビーに戻ります"),
      };
  }
}

function describeJackpotDraw(jackpot: JackpotProgress | null): Guidance {
  if (!jackpot) return { game: "jackpot", now: "ジャックポット: 抽選画面を準備中", main: null };
  const phaseText = jackpot.phase === "member" ? "メンバー抽選" : jackpot.phase === "prize" ? "景品抽選" : "抽選の準備中";
  const result = jackpot.member || jackpot.prize ? ` ・ 当選者: ${jackpot.member ?? "—"} ・ 景品: ${jackpot.prize ?? "—"}` : "";
  const now = `ジャックポット: ${phaseText}${result}`;
  if (jackpot.canStop) {
    return {
      game: "jackpot",
      now,
      main: { label: "止める", hint: `${jackpot.phase === "prize" ? "景品" : "メンバー"}のルーレットを止めて、結果を決めます`, action: { kind: "advance" } },
    };
  }
  const hint =
    jackpot.phase === "member" ? "メンバー抽選を進めます(回し始める/結果を発表する)" : jackpot.phase === "prize" ? "景品抽選を進めます(回し始める/結果を発表する)" : "抽選を始めます";
  return { game: "jackpot", now, main: { label: "次へ", hint, action: { kind: "advance" } } };
}

/** 説明画面のスライド。コントロールから1枚ずつ進め/戻せる。最後のスライドの次で抽選画面へ進む。 */
function describeJackpotDescription(input: GuidanceInput): Guidance {
  const step = JACKPOT_FLOW["/jackpot-description"];
  const jp = input.jackpot;
  const toDraw = { kind: "navigate", path: withDemo(step.to, input.demo) } as const;
  const base = { game: "jackpot" as const, now: step.now };
  // スライドの位置がまだ届いていない(古いホスト・読み込み中)ときは、従来どおり抽選画面へ進める
  if (!jp || jp.page !== "description" || typeof jp.index !== "number" || typeof jp.total !== "number") {
    return { ...base, main: { label: step.label, hint: step.hint, action: toDraw }, back: null };
  }
  const { index, total } = jp;
  const back = index >= 0 ? { label: "前へ", hint: index === 0 ? "導入の画面に戻します" : "ひとつ前のスライドに戻します" } : null;
  if (index >= total - 1) {
    return { ...base, now: total > 0 ? `${step.now}(${total}/${total})` : step.now, main: { label: step.label, hint: step.hint, action: toDraw }, back };
  }
  const position = `${index + 2}/${total}`;
  return {
    game: "jackpot",
    now: index < 0 ? `${step.now}(導入)` : `${step.now}(${index + 1}/${total})`,
    main: { label: `次のスライドへ (${position})`, hint: index < 0 ? "説明の最初のスライドを映します" : "次のスライドを映します", action: { kind: "advance" } },
    back,
  };
}

export function describeProgress(input: GuidanceInput): Guidance {
  if (!input.hostOnline) return { game: null, now: "ホストの画面が開かれていません", main: null };

  const hostPath = input.hostPath.split("?")[0];
  const quiz = quizPage(hostPath);
  if (quiz) return describeQuiz(input, quiz);

  const jp = jackpotPage(hostPath);
  if (jp === "/jackpot-draw") return describeJackpotDraw(input.jackpot);
  if (jp === "/jackpot-description") return describeJackpotDescription(input);
  if (jp && JACKPOT_FLOW[jp]) {
    const step = JACKPOT_FLOW[jp];
    return {
      game: "jackpot",
      now: step.now,
      main: { label: step.label, hint: step.hint, action: { kind: "navigate", path: withDemo(step.to, input.demo) } },
    };
  }
  if (jp === "/jackpot-ending") return { game: "jackpot", now: "ジャックポット: エンディング表示中", main: null };
  if (/^\/event-entry$/.test(hostPath)) return { game: null, now: "会場の画面にエントリー受付を映しています", main: null };
  return { game: null, now: "待機中(ロビーを映しています)", main: null };
}
