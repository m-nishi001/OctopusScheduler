import { injectable } from "tsyringe";
import { Quiz } from "../../domains/entities/quiz";
import { LocalStorageService } from "@common-lib/storage/local-storage-service";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import type { QuizWithDataUrl } from "quiz-game-api";
import { dataUrlToBlob } from "../../../utils/blob-utils";

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
  ): Promise<{
    successCount: number;
    failedCount: number;
    failedFiles: string[];
  }> {
    const failedFiles: string[] = [];
    let successCount = 0;

    if (direction === "gas-to-local") {
      onProgress?.("GASからクイズを取得中...");
      const jsonService = new GasFunctionService("_quizGame_getJson");
      const jsonResp = await jsonService.call<{ json: string }>({});
      const jsonText = jsonResp?.json ?? JSON.stringify([]);
      let quizzes: QuizWithDataUrl[] = [];
      try {
        quizzes = JSON.parse(jsonText) as QuizWithDataUrl[];
      } catch {
        quizzes = [];
      }

      if (quizzes.length === 0) {
        onProgress?.("GASにクイズが見つかりませんでした。");
        return { successCount: 0, failedCount: 0, failedFiles: [] };
      }

      onProgress?.(
        `${quizzes.length}件のクイズが見つかりました。保存を開始します。`
      );

      // helper: bounded concurrency map
      const mapWithConcurrency = async <T, R>(
        items: T[],
        fn: (t: T) => Promise<R>,
        concurrency = 5
      ) => {
        const results: R[] = [];
        let idx = 0;
        const workers = new Array(concurrency).fill(null).map(async () => {
          while (idx < items.length) {
            const i = idx++;
            // eslint-disable-next-line no-await-in-loop
            results[i] = await fn(items[i]);
          }
        });
        await Promise.all(workers);
        return results;
      };

      const getDriveDataService = new GasFunctionService(
        "_quizGame_getDriveData"
      );

      for (const q of quizzes) {
        onProgress?.(`クイズを保存中: ${q.title}`);

        const assetTasks: Array<() => Promise<void>> = [];

        if (q.bgm && typeof q.bgm === "string" && q.bgm.startsWith("drive:")) {
          const fid = q.bgm.replace(/^drive:/, "");
          assetTasks.push(async () => {
            try {
              const data = await getDriveDataService.call<any>(fid);
              if (data && data.fileDataUrl) {
                q.bgm = data.fileDataUrl;
                successCount++;
              } else {
                failedFiles.push(fid);
                q.bgm = null;
              }
            } catch (e) {
              failedFiles.push(fid);
              q.bgm = null;
            }
          });
        }

        q.options = q.options.map((o: any) => ({ ...o }));
        q.options.forEach((o: any) => {
          if (
            o.image &&
            typeof o.image === "string" &&
            o.image.startsWith("drive:")
          ) {
            const fid = o.image.replace(/^drive:/, "");
            assetTasks.push(async () => {
              try {
                const data = await getDriveDataService.call<any>(fid);
                if (data && data.fileDataUrl) {
                  o.image = data.fileDataUrl;
                  successCount++;
                } else {
                  failedFiles.push(fid);
                  o.image = null;
                }
              } catch (e) {
                failedFiles.push(fid);
                o.image = null;
              }
            });
          }
        });

        await mapWithConcurrency(assetTasks, (t) => t(), 5);

        // convert dataUrls to Blobs and save locally
        const quiz = new Quiz({
          id: q.id,
          title: q.title,
          question: q.question,
          options: await Promise.all(
            q.options.map(async (o) => ({
              no: o.no,
              text: o.text,
              color: o.color,
              image: o.image ? await dataUrlToBlob(o.image) : null,
            }))
          ),
          correctNo: q.correctNo ?? 1,
          formUrl: q.formUrl,
          timeLimit: q.timeLimit,
          bgm: q.bgm ? await dataUrlToBlob(q.bgm) : null,
          settings: q.settings
            ? {
                correctBgmDataUrl: q.settings.correctBgmDataUrl,
                prizeImageDataUrl: q.settings.prizeImageDataUrl,
                prizeName: q.settings.prizeName,
                prizeBgmDataUrl: q.settings.prizeBgmDataUrl,
              }
            : undefined,
        });
        await this.saveQuiz(quiz);
      }

      onProgress?.("GASからローカルへの同期が完了しました。");
      return { successCount, failedCount: failedFiles.length, failedFiles };
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
          correctNo: q.correctNo,
          formUrl: q.formUrl,
          timeLimit: q.timeLimit,
          bgm:
            q.bgm && typeof q.bgm !== "string"
              ? await this.blobToDataUrl(q.bgm)
              : (q.bgm as string | null),
          settings: q.settings,
        }))
      );

      onProgress?.("アセットをアップロード中...");

      type AssetTask = {
        quizId: string;
        type: "bgm" | "option" | "prizeImage" | "prizeBgm";
        idx?: number;
        dataUrl: string;
        fileName: string;
      };

      const assets: AssetTask[] = [];
      for (const q of quizzesWithDataUrl) {
        if (q.bgm && typeof q.bgm === "string" && q.bgm.startsWith("data:")) {
          assets.push({
            quizId: q.id,
            type: "bgm",
            idx: 0,
            dataUrl: q.bgm,
            fileName: `${q.id}_bgm`,
          });
        }
        q.options.forEach((o: any, idx: number) => {
          if (
            o.image &&
            typeof o.image === "string" &&
            o.image.startsWith("data:")
          ) {
            assets.push({
              quizId: q.id,
              type: "option",
              idx,
              dataUrl: o.image,
              fileName: `${q.id}_option_${idx}`,
            });
          }
        });
        if (q.settings) {
          if (
            q.settings.prizeImageDataUrl &&
            q.settings.prizeImageDataUrl.startsWith("data:")
          ) {
            assets.push({
              quizId: q.id,
              type: "prizeImage" as any,
              idx: 0,
              dataUrl: q.settings.prizeImageDataUrl,
              fileName: `${q.id}_prize_image`,
            });
          }
          if (
            q.settings.prizeBgmDataUrl &&
            q.settings.prizeBgmDataUrl.startsWith("data:")
          ) {
            assets.push({
              quizId: q.id,
              type: "prizeBgm" as any,
              idx: 0,
              dataUrl: q.settings.prizeBgmDataUrl,
              fileName: `${q.id}_prize_bgm`,
            });
          }
        }
      }

      const uploadService = new GasFunctionService("_quizGame_addDriveData");
      const concurrency = 5;
      const uploadResults: Array<{
        task: AssetTask;
        success: boolean;
        fileId?: string;
        error?: string;
      }> = [];

      const uploader = async (task: AssetTask) => {
        try {
          const driveDataId = `${task.quizId}_${task.type}_${task.idx ?? 0}_${crypto.randomUUID()}`;
          const mime =
            (task.dataUrl.match(/data:([^;]+);/) || [])[1] ||
            "application/octet-stream";
          const payload: any = {
            metadata: { driveDataId },
            fileName: task.fileName,
            fileKind: mime,
            fileDataUrl: task.dataUrl,
            uploadDate: new Date().toISOString(),
          };
          const meta = await uploadService.call<any>(payload);
          uploadResults.push({ task, success: true, fileId: meta?.fileId });
        } catch (e: any) {
          uploadResults.push({
            task,
            success: false,
            error: e?.message ?? String(e),
          });
        }
      };

      for (let i = 0; i < assets.length; i += concurrency) {
        const batch = assets.slice(i, i + concurrency);
        await Promise.all(batch.map((a) => uploader(a)));
        onProgress?.(
          `アップロード中: ${Math.min(i + concurrency, assets.length)}/${assets.length}`
        );
      }

      // apply results back to quizzesWithDataUrl (best-effort)
      for (const r of uploadResults) {
        if (!r.success || !r.fileId) continue;
        const { quizId, type, idx } = r.task;
        const quiz = quizzesWithDataUrl.find((q) => q.id === quizId);
        if (!quiz) continue;
        if (type === "bgm") {
          quiz.bgm = `drive:${r.fileId}`;
          successCount++;
        } else if (type === "option") {
          if (typeof idx === "number" && quiz.options[idx]) {
            quiz.options[idx].image = `drive:${r.fileId}`;
            successCount++;
          }
        } else if (type === "prizeImage") {
          if (quiz.settings) {
            quiz.settings.prizeImageDataUrl = `drive:${r.fileId}`;
            successCount++;
          }
        } else if (type === "prizeBgm") {
          if (quiz.settings) {
            quiz.settings.prizeBgmDataUrl = `drive:${r.fileId}`;
            successCount++;
          }
        }
      }

      // record failures
      for (const r of uploadResults) {
        if (!r.success) {
          failedFiles.push(
            r.task.fileName || `${r.task.quizId}_${r.task.type}_${r.task.idx}`
          );
        }
      }

      // best-effort cleanup: remove existing json/assets then add new json
      try {
        const listJson = new GasFunctionService("_quizGame_listJsonMetaData");
        const jsonMeta = await listJson.call<any>({});
        if (Array.isArray(jsonMeta)) {
          const remover = new GasFunctionService("_quizGame_removeDriveData");
          await Promise.all(
            jsonMeta.map((m: any) => remover.call<void>(m.fileId))
          );
        }
      } catch (_) {}

      try {
        const listAssets = new GasFunctionService("_quizGame_getDriveMetaData");
        const assetMeta = await listAssets.call<any>({});
        if (Array.isArray(assetMeta)) {
          const remover = new GasFunctionService("_quizGame_removeDriveData");
          await Promise.all(
            assetMeta.map((m: any) => remover.call<void>(m.fileId))
          );
        }
      } catch (_) {}

      try {
        const addJson = new GasFunctionService("_quizGame_addJson");
        const jsonText = JSON.stringify(quizzesWithDataUrl);
        await addJson.call<any>({ fileName: "quizzes.json", jsonText });
      } catch (e) {
        // ignore json write errors for best-effort; record as failure
        failedFiles.push("quizzes.json");
      }

      onProgress?.("ローカルからGASへの同期が完了しました。");
      return { successCount, failedCount: failedFiles.length, failedFiles };
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
}
