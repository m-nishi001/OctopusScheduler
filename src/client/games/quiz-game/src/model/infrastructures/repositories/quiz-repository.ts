import { injectable } from "tsyringe";
import { Quiz } from "../../domains/entities/quiz";
import { LocalStorageService } from "@common-lib/storage/local-storage-service";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import type { QuizWithDataUrl } from "quiz-game-api";

@injectable()
export class QuizRepository {
  private readonly localStorage = new LocalStorageService(
    "quiz-game",
    "QuizData"
  );

  async getQuizById(id: string): Promise<Quiz | null> {
    return (await this.localStorage.get<Quiz>(id)) || null;
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    const allQuizzes = await this.localStorage.getAll<Quiz>();
    return Array.from(allQuizzes.values());
  }

  async saveQuiz(quiz: Quiz): Promise<void> {
    await this.localStorage.save(quiz.id, quiz);
  }

  async addQuiz(quiz: Omit<Quiz, "id">): Promise<string> {
    const id = crypto.randomUUID();
    const newQuiz: Quiz = { ...quiz, id };
    await this.localStorage.save(id, newQuiz);
    return id;
  }

  async deleteQuiz(id: string): Promise<void> {
    await this.localStorage.delete(id);
  }

  async syncQuizzes(
    direction: "gas-to-local" | "local-to-gas",
    onProgress?: (message: string) => void
  ): Promise<void> {
    if (direction === "gas-to-local") {
      onProgress?.("GASからクイズを取得中...");
      const service = new GasFunctionService("_quizGame_syncQuizzes");
      const quizzes = await service.call<QuizWithDataUrl[]>({ direction });
      if (quizzes) {
        onProgress?.(
          `${quizzes.length}件のクイズが見つかりました。保存を開始します。`
        );
        for (const q of quizzes) {
          onProgress?.(`クイズを保存中: ${q.title}`);
          const quiz = new Quiz({
            id: q.id,
            title: q.title,
            question: q.question,
            options: await Promise.all(
              q.options.map(async (o) => ({
                no: o.no,
                text: o.text,
                color: o.color,
                image: o.image ? await this.dataUrlToBlob(o.image) : null,
              }))
            ),
            correctNo: q.correctNo ?? 1,
            formUrl: q.formUrl,
            timeLimit: q.timeLimit,
            bgm: q.bgm ? await this.dataUrlToBlob(q.bgm) : null,
          });
          await this.saveQuiz(quiz);
        }
        onProgress?.("GASからローカルへの同期が完了しました。");
      } else {
        onProgress?.("GASにクイズが見つかりませんでした。");
      }
    } else {
      onProgress?.("ローカルクイズを取得中...");
      const quizzes = await this.getAllQuizzes();
      onProgress?.(`${quizzes.length}件のクイズを変換中...`);
      const quizzesWithDataUrl: QuizWithDataUrl[] = await Promise.all(
        quizzes.map(async (q) => ({
          id: q.id,
          title: q.title,
          question: q.question,
          options: await Promise.all(
            q.options.map(async (o) => ({
              no: o.no,
              text: o.text,
              color: o.color,
              image:
                o.image && typeof o.image !== "string"
                  ? await this.blobToDataUrl(o.image)
                  : (o.image as string | null),
            }))
          ),
          correctNo: (q as any).correctNo ?? 1,
          formUrl: q.formUrl,
          timeLimit: q.timeLimit,
          bgm:
            q.bgm && typeof q.bgm !== "string"
              ? await this.blobToDataUrl(q.bgm)
              : (q.bgm as string | null),
        }))
      );
      onProgress?.("GASに送信中...");
      const service = new GasFunctionService("_quizGame_syncQuizzes");
      await service.call<void>({ direction, quizzes: quizzesWithDataUrl });
      onProgress?.("ローカルからGASへの同期が完了しました。");
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    if (!dataUrl) return new Blob();
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return blob;
    } catch (e) {
      return new Blob();
    }
  }
}
