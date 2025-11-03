import { injectable } from "tsyringe";
import { GasFunctionService } from "packages/common-lib/google-apps-script/gas-script-service";
import { Quiz } from "../entities/quiz";

interface QuizWithDataUrl {
  id: string;
  title: string;
  question: string;
  options: { text: string; color: string; image: string | null }[];
  formUrl: string;
  timeLimit: number;
  bgm: string | null;
}

@injectable()
export class QuizRepository {
  private readonly STORAGE_KEY = "quizzes";

  constructor() {}

  async getQuizById(id: string): Promise<Quiz | null> {
    const quizzes = this.getStoredQuizzes();
    const quizData = quizzes.find((q) => q.id === id);
    return quizData ? this.quizWithDataUrlToQuiz(quizData) : null;
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    const quizzes = this.getStoredQuizzes();
    return quizzes.map((q) => this.quizWithDataUrlToQuiz(q));
  }

  async addQuiz(quizData: Omit<Quiz, "id">): Promise<string> {
    const id = crypto.randomUUID();
    const newQuiz = new Quiz({ ...quizData, id });
    const quizDataWithUrl = await this.quizToQuizWithDataUrl(newQuiz);
    const quizzes = this.getStoredQuizzes();
    quizzes.push(quizDataWithUrl);
    this.saveQuizzes(quizzes);
    return newQuiz.id;
  }

  async updateQuiz(quiz: Quiz): Promise<void> {
    const quizData = await this.quizToQuizWithDataUrl(quiz);
    const quizzes = this.getStoredQuizzes();
    const index = quizzes.findIndex((q) => q.id === quiz.id);
    if (index !== -1) {
      quizzes[index] = quizData;
      this.saveQuizzes(quizzes);
    }
  }

  async deleteQuiz(id: string): Promise<void> {
    const quizzes = this.getStoredQuizzes();
    const filtered = quizzes.filter((q) => q.id !== id);
    this.saveQuizzes(filtered);
  }

  async syncQuizzes(direction: "gas-to-local" | "local-to-gas"): Promise<void> {
    const service = new GasFunctionService("syncQuizzes");
    if (direction === "gas-to-local") {
      const quizzesData: QuizWithDataUrl[] = await service.call<
        QuizWithDataUrl[]
      >({ direction });
      this.saveQuizzes(quizzesData);
    } else {
      const quizzes = this.getStoredQuizzes();
      await service.call<void>({ direction, quizzes });
    }
  }

  private blobToDataUrl(blob: Blob | null): Promise<string | null> {
    if (!blob) return Promise.resolve(null);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  private dataUrlToBlob(dataUrl: string | null): Blob | null {
    if (!dataUrl) return null;
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  private async quizToQuizWithDataUrl(quiz: Quiz): Promise<QuizWithDataUrl> {
    const options = await Promise.all(
      quiz.options.map(async (option) => ({
        text: option.text,
        color: option.color,
        image: await this.blobToDataUrl(option.image),
      }))
    );
    const bgm = await this.blobToDataUrl(quiz.bgm);
    return {
      id: quiz.id,
      title: quiz.title,
      question: quiz.question,
      options,
      formUrl: quiz.formUrl,
      timeLimit: quiz.timeLimit,
      bgm,
    };
  }

  private quizWithDataUrlToQuiz(quizData: QuizWithDataUrl): Quiz {
    return new Quiz({
      title: quizData.title,
      question: quizData.question,
      options: quizData.options.map((option) => ({
        text: option.text,
        color: option.color,
        image: this.dataUrlToBlob(option.image),
      })),
      formUrl: quizData.formUrl,
      timeLimit: quizData.timeLimit,
      bgm: this.dataUrlToBlob(quizData.bgm),
    });
  }

  private getStoredQuizzes(): QuizWithDataUrl[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private saveQuizzes(quizzes: QuizWithDataUrl[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(quizzes));
  }
}
