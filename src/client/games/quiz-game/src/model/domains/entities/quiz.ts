export interface QuizSettings {
  correctBgmDataUrl: string | null;
  prizeImageDataUrl: string | null;
  prizeName: string;
  prizeBgmDataUrl: string | null;
}

export class Quiz {
  id: string;
  title: string;
  question: string;
  options: {
    no: number;
    text: string;
    color: string;
    image: Blob | string | null;
  }[];
  correctNo: number;
  formUrl: string;
  timeLimit: number;
  bgm: Blob | string | null;
  settings?: QuizSettings;

  constructor(quizData: Omit<Quiz, "id" | "getFormId"> | Quiz) {
    this.id = "id" in quizData ? quizData.id : "";
    this.title = quizData.title;
    this.question = quizData.question;
    this.options = quizData.options;
    this.correctNo = (quizData as any).correctNo ?? 1;
    this.formUrl = quizData.formUrl;
    this.timeLimit = quizData.timeLimit;
    this.bgm = quizData.bgm;
    this.settings = quizData.settings;
  }

  /**
   * Extract formId from the stored formUrl.
   * Supports patterns like `/d/e/{id}/`, `/d/{id}/` and `?id={id}`.
   */
  getFormId(): string | null {
    if (!this.formUrl) return null;
    try {
      const m1 = (this.formUrl as string).match(/\/d\/e\/([a-zA-Z0-9_-]+)/);
      if (m1 && m1[1]) return m1[1];
      const m2 = (this.formUrl as string).match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m2 && m2[1]) return m2[1];
      const qm = (this.formUrl as string).match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (qm && qm[1]) return qm[1];
    } catch (e) {
      // swallow and return null for invalid URLs
    }
    return null;
  }
}
