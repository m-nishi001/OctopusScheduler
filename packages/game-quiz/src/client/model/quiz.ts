export interface QuizSettings {
  correctBgm: Blob | null;
  prizeImage: Blob | null;
  prizeName: string | null;
  prizeBgm: Blob | null;
}

/** クイズ1問(問題・選択肢・正解・制限時間・BGM・設定)。選択肢の画像と BGM は Blob で持つ。 */
export class Quiz {
  id: string;
  title: string;
  question: string;
  options: {
    no: number;
    text: string;
    color: string;
    image: Blob | null;
  }[];
  correctNo: number;
  timeLimit: number;
  bgm: Blob | null;
  settings?: QuizSettings;

  constructor(quizData: Omit<Quiz, "id"> | Quiz) {
    this.id = "id" in quizData ? quizData.id : "";
    this.title = quizData.title;
    this.question = quizData.question;
    this.options = quizData.options;
    this.correctNo = (quizData as any).correctNo ?? 1;
    this.timeLimit = quizData.timeLimit;
    this.bgm = quizData.bgm;
    this.settings = quizData.settings;
  }

  /**
   * Create a Quiz instance from a plain DTO (deserialized object).
   * This rehydrates objects read from local storage so instance methods
   * are available.
   */
  static fromDto(dto: any): Quiz {
    if (!dto) throw new Error("Invalid quiz dto");

    const options = Array.isArray(dto.options)
      ? dto.options.map((o: any) => ({
          no: o?.no ?? 0,
          text: o?.text ?? "",
          color: o?.color ?? "",
          image: o?.image ?? null,
        }))
      : [];

    const quizData: any = {
      id: dto.id ?? "",
      title: dto.title ?? "",
      question: dto.question ?? "",
      options,
      correctNo: dto.correctNo ?? 1,
      timeLimit: dto.timeLimit ?? 0,
      bgm: dto.bgm ?? null,
      settings: dto.settings,
    };

    return new Quiz(quizData);
  }
}

/** 選択肢の編集で扱う最小の形。正解 `correctNo` は常に選択肢の `no`(位置ではない)で持つ。 */
export interface QuizOptionsState<O extends { no: number } = { no: number }> {
  options: O[];
  correctNo?: number;
}

/** 新しい選択肢に振る no(既存の最大値 + 1)。 */
export function nextOptionNo(options: readonly { no: number }[]): number {
  return options.reduce((max, o) => Math.max(max, o.no || 0), 0) + 1;
}

/** 選択肢を末尾に追加する。no は最大値 + 1、正解は変えない。 */
export function addOption<O extends { no: number }, Q extends QuizOptionsState<O>>(
  quiz: Q,
  fields: Omit<O, "no">,
): Q {
  const option = { ...fields, no: nextOptionNo(quiz.options) } as O;
  return { ...quiz, options: [...quiz.options, option] };
}

/** 選択肢を削除する。消したのが正解のときだけ、残った先頭の選択肢の no に移す。 */
export function removeOption<Q extends QuizOptionsState>(quiz: Q, no: number): Q & { correctNo: number } {
  const options = quiz.options.filter((o) => o.no !== no);
  const correctNo = quiz.correctNo === no ? (options[0]?.no ?? 1) : (quiz.correctNo ?? 1);
  return { ...quiz, options, correctNo };
}

/** 正解を選択肢の no で指定する。存在しない no は無視する。 */
export function setCorrect<Q extends QuizOptionsState>(quiz: Q, no: number): Q {
  return quiz.options.some((o) => o.no === no) ? { ...quiz, correctNo: no } : quiz;
}

/** 正解が存在する選択肢の no を指していることを保証する(数値化し、無効なら先頭の no、選択肢なしなら 1)。 */
export function normalizeCorrectNo<Q extends QuizOptionsState>(quiz: Q): Q & { correctNo: number } {
  const no = Number(quiz.correctNo);
  const valid = quiz.options.some((o) => o.no === no);
  return { ...quiz, correctNo: valid ? no : (quiz.options[0]?.no ?? 1) };
}
