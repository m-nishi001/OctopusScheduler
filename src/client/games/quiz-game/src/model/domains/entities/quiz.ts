export interface QuizSettings {
  correctBgm: Blob | null;
  prizeImage: Blob | null;
  prizeName: string | null;
  prizeBgm: Blob | null;
}

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
  formUrl: string;
  answerFormId: string;
  timeLimit: number;
  bgm: Blob | null;
  settings?: QuizSettings;

  constructor(quizData: Omit<Quiz, "id" | "getFormId"> | Quiz) {
    this.id = "id" in quizData ? quizData.id : "";
    this.title = quizData.title;
    this.question = quizData.question;
    this.options = quizData.options;
    this.correctNo = (quizData as any).correctNo ?? 1;
    this.formUrl = quizData.formUrl;
    this.answerFormId = quizData.answerFormId ?? "";
    this.timeLimit = quizData.timeLimit;
    this.bgm = quizData.bgm;
    this.settings = quizData.settings;
  }

  /**
   * Create a Quiz instance from a plain DTO (deserialized object).
   * This rehydrates objects read from local storage so instance methods
   * such as `getFormId()` are available.
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
      formUrl: dto.formUrl ?? dto.answerUrl ?? "",
      answerFormId: dto.answerFormId,
      timeLimit: dto.timeLimit ?? 0,
      bgm: dto.bgm ?? null,
      settings: dto.settings,
    };

    return new Quiz(quizData);
  }
}
