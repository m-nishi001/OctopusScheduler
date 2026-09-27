import { inject, injectable } from "tsyringe";
import { Quiz } from "./quiz";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { DirtyTracker } from "@octopus/sync-engine";
import type { SyncTarget } from "@octopus/sync-engine";
import { IQuizGameApiToken } from "../../server/quiz-api-contract";
import type { QuizGameApi, QuizWithDataUrl } from "../../server/quiz-api-contract";
import { dataUrlToBlob } from "./blob-utils";
import type { DriveJsonData, DriveMetadata } from "@octopus/infrastructures/compositions";

const METADATA_SYNC_KIND = "quizzes-meta";
const METADATA_FILE_NAME = "quizzes.json";
const ASSET_SYNC_KIND = "quiz-asset";

type AssetSlotType = "bgm" | "option" | "prizeImage" | "prizeBgm";

@injectable()
export class QuizRepository {
  private readonly localStorage = new LocalStorageService(
    "quiz-game",
    "QuizData"
  );
  private readonly dirtyTracker = new DirtyTracker("quiz-game");

  constructor(
    @inject(IQuizGameApiToken) private readonly quizApi: QuizGameApi
  ) {}

  async getQuizById(id: string): Promise<Quiz | null> {
    const raw = await this.localStorage.get<any>(id);
    if (!raw) return null;
    try {
      return Quiz.fromDto(raw);
    } catch (e) {
      console.warn("[QuizRepository] failed to rehydrate quiz for id=", id, e);
      return null;
    }
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    const allQuizzes = await this.localStorage.getAll<any>();
    const out: Quiz[] = [];
    for (const v of Array.from(allQuizzes.values())) {
      try {
        if (!v) continue;
        out.push(Quiz.fromDto(v));
      } catch (e) {
        console.warn(
          "[QuizRepository] getAllQuizzes: failed to rehydrate item",
          e
        );
      }
    }
    return out;
  }

  async saveQuiz(quiz: Quiz): Promise<void> {
    await this.localStorage.save(quiz.id, quiz);
    await this.dirtyTracker.touch(METADATA_SYNC_KIND);
    eventBus.emit("syncDirty");
  }

  async addQuiz(quiz: Omit<Quiz, "id">): Promise<string> {
    const id = crypto.randomUUID();
    const newQuiz: Quiz = { ...quiz, id };
    await this.localStorage.save(id, newQuiz);
    await this.dirtyTracker.touch(METADATA_SYNC_KIND);
    eventBus.emit("syncDirty");
    return id;
  }

  async deleteQuiz(id: string): Promise<void> {
    await this.localStorage.delete(id);
    await this.dirtyTracker.touch(METADATA_SYNC_KIND);
    eventBus.emit("syncDirty");
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  }

  // --- 同期対象のid規約 ---
  // アセットは quiz-game の JSON blob(quizzes.json)には実体を含めず、
  // `drive:<slotId>` という参照文字列だけを埋め込む。slotIdは
  // 「クイズid + スロット種別(+ 選択肢番号)」から機械的に組み立てる安定した
  // idなので、旧実装のようにアップロードのたびに新しいdriveDataIdを生成して
  // 別ファイルとして積み上がっていく(かつ毎回全消去してからやり直す)ことがない。
  private slotId(quizId: string, type: AssetSlotType, idx?: number): string {
    return type === "option" ? `${quizId}::option::${idx}` : `${quizId}::${type}`;
  }

  /**
   * バックグラウンド同期エンジン向けに、クイズ一覧のメタデータ(1つのJSON blob)と
   * 各クイズのアセット(bgm/選択肢画像/賞品画像/賞品bgm、ファイル単位)を
   * SyncTargetとして列挙する。
   */
  async listSyncTargets(): Promise<SyncTarget[]> {
    let remoteQuizzes: QuizWithDataUrl[] = [];
    let remoteMetaUpdatedAt = 0;
    try {
      const resp = await this.quizApi.getJson({});
      remoteMetaUpdatedAt = resp.updatedAt ? new Date(resp.updatedAt).getTime() : 0;
      const parsed = JSON.parse(resp.json || "[]");
      if (Array.isArray(parsed)) remoteQuizzes = parsed;
    } catch (e) {
      console.error(
        "[QuizRepository] Failed to fetch remote quizzes metadata for sync",
        e
      );
    }

    let remoteAssetMetas: DriveMetadata[] = [];
    try {
      remoteAssetMetas = (await this.quizApi.getDriveMetaData({})) || [];
    } catch (e) {
      console.error(
        "[QuizRepository] Failed to fetch remote quiz asset metadata for sync",
        e
      );
    }
    const remoteAssetMap = new Map<string, DriveMetadata>();
    for (const m of remoteAssetMetas) {
      if (m?.driveDataId) remoteAssetMap.set(String(m.driveDataId), m);
    }

    const targets: SyncTarget[] = [
      this.buildQuizzesMetaTarget(remoteQuizzes, remoteMetaUpdatedAt),
      ...(await this.buildAssetTargets(remoteAssetMap)),
    ];
    return targets;
  }

  private buildQuizzesMetaTarget(
    remoteQuizzes: QuizWithDataUrl[],
    remoteUpdatedAt: number
  ): SyncTarget<QuizWithDataUrl[], QuizWithDataUrl[]> {
    return {
      id: METADATA_SYNC_KIND,
      kind: METADATA_SYNC_KIND,
      getLocal: async () => {
        const quizzes = await this.getAllQuizzes();
        if (quizzes.length === 0) return null;
        const trackedAt = await this.dirtyTracker.getUpdatedAt(METADATA_SYNC_KIND);
        return {
          data: quizzes.map((q) => this.toWireEntry(q)),
          updatedAt: trackedAt ?? Date.now(),
        };
      },
      getRemote: async () => {
        if (remoteQuizzes.length === 0) return null;
        return { data: remoteQuizzes, updatedAt: remoteUpdatedAt };
      },
      push: async (entries) => {
        const driveJson: DriveJsonData = {
          metadata: {} as any,
          fileName: METADATA_FILE_NAME,
          jsonText: JSON.stringify(entries),
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        };
        const meta = await this.quizApi.addJson({ driveJson });
        const updatedAt = meta?.lastUpdate
          ? new Date(meta.lastUpdate).getTime()
          : Date.now();
        await this.dirtyTracker.touch(METADATA_SYNC_KIND, updatedAt);
        return { updatedAt };
      },
      pull: async (entries) => {
        for (const entry of entries) {
          await this.upsertQuizMetadata(entry);
        }
        const updatedAt = Date.now();
        await this.dirtyTracker.touch(METADATA_SYNC_KIND, updatedAt);
        return { updatedAt };
      },
    };
  }

  /** ローカルのQuizを、アセット実体を含まないワイヤー形式(drive:参照のみ)に変換する。 */
  private toWireEntry(q: Quiz): QuizWithDataUrl {
    return {
      id: q.id,
      title: q.title,
      question: q.question,
      options: q.options.map((o, idx) => ({
        no: o.no,
        text: o.text,
        color: o.color,
        image: o.image ? `drive:${this.slotId(q.id, "option", idx)}` : null,
      })),
      correctNo: q.correctNo,
      timeLimit: q.timeLimit,
      bgm: q.bgm ? `drive:${this.slotId(q.id, "bgm")}` : null,
      settings: q.settings
        ? {
            // correctBgmは旧実装でもDriveへアップロードされておらず、この
            // 同期対象には含めない(既存の未解決の欠落を踏襲する)。
            correctBgmDataUrl: null,
            prizeImageDataUrl: q.settings.prizeImage
              ? `drive:${this.slotId(q.id, "prizeImage")}`
              : null,
            prizeName: q.settings.prizeName ?? "",
            prizeBgmDataUrl: q.settings.prizeBgm
              ? `drive:${this.slotId(q.id, "prizeBgm")}`
              : null,
          }
        : undefined,
    };
  }

  /**
   * リモートのメタデータをローカルへ反映する。テキスト系フィールドのみを
   * 上書きし、アセット(Blob)フィールドは既存のローカル値を保持する
   * (アセット自体の同期は各SyncTarget(kind: quiz-asset)が独立して担う)。
   */
  private async upsertQuizMetadata(entry: QuizWithDataUrl): Promise<void> {
    const existingRaw = await this.localStorage.get<any>(entry.id);
    const existing = existingRaw ? Quiz.fromDto(existingRaw) : null;
    const quiz = new Quiz({
      id: entry.id,
      title: entry.title,
      question: entry.question,
      options: entry.options.map((o, idx) => ({
        no: o.no,
        text: o.text,
        color: o.color,
        image: existing?.options[idx]?.image ?? null,
      })),
      correctNo: entry.correctNo ?? 1,
      timeLimit: entry.timeLimit,
      bgm: existing?.bgm ?? null,
      settings: entry.settings
        ? {
            correctBgm: existing?.settings?.correctBgm ?? null,
            prizeImage: existing?.settings?.prizeImage ?? null,
            prizeName: entry.settings.prizeName ?? "",
            prizeBgm: existing?.settings?.prizeBgm ?? null,
          }
        : undefined,
    });
    await this.localStorage.save(entry.id, quiz);
  }

  private async buildAssetTargets(
    remoteAssetMap: Map<string, DriveMetadata>
  ): Promise<SyncTarget<Blob, DriveMetadata>[]> {
    const localQuizzes = await this.getAllQuizzes();
    const localSlotBlob = new Map<string, Blob>();

    for (const q of localQuizzes) {
      if (q.bgm) localSlotBlob.set(this.slotId(q.id, "bgm"), q.bgm);
      q.options.forEach((o, idx) => {
        if (o.image) localSlotBlob.set(this.slotId(q.id, "option", idx), o.image);
      });
      if (q.settings?.prizeImage) {
        localSlotBlob.set(this.slotId(q.id, "prizeImage"), q.settings.prizeImage);
      }
      if (q.settings?.prizeBgm) {
        localSlotBlob.set(this.slotId(q.id, "prizeBgm"), q.settings.prizeBgm);
      }
    }

    const slotIds = new Set<string>([
      ...localSlotBlob.keys(),
      ...remoteAssetMap.keys(),
    ]);

    return Array.from(slotIds).map((id) =>
      this.buildAssetSyncTarget(id, localSlotBlob, remoteAssetMap)
    );
  }

  private buildAssetSyncTarget(
    id: string,
    localSlotBlob: Map<string, Blob>,
    remoteAssetMap: Map<string, DriveMetadata>
  ): SyncTarget<Blob, DriveMetadata> {
    const quizId = id.split("::")[0];
    return {
      id,
      kind: ASSET_SYNC_KIND,
      getLocal: async () => {
        const blob = localSlotBlob.get(id);
        if (!blob) return null;
        const stored = await this.localStorage.getWithMeta<any>(quizId);
        return { data: blob, updatedAt: stored?.updatedAt ?? Date.now() };
      },
      getRemote: async () => {
        const meta = remoteAssetMap.get(id);
        if (!meta) return null;
        return { data: meta, updatedAt: new Date(meta.lastUpdate).getTime() };
      },
      push: async (blob) => {
        const dataUrl = await this.blobToDataUrl(blob);
        const clientNow = new Date().toISOString();
        const driveData: any = {
          metadata: {
            driveDataId: id,
            fileId: "",
            parentFolderId: "",
            lastUpdate: clientNow,
            size: blob.size || 0,
          },
          fileName: id,
          fileKind: blob.type || "application/octet-stream",
          fileDataUrl: dataUrl,
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        };
        if (remoteAssetMap.has(id)) {
          await this.quizApi.updateDriveData({ driveData });
        } else {
          await this.quizApi.addDriveData({ driveData });
        }
        return { updatedAt: new Date(clientNow).getTime() };
      },
      pull: async (meta) => {
        const data = await this.quizApi.getDriveData({ dataId: meta.fileId });
        const blob = data?.fileDataUrl ? dataUrlToBlob(data.fileDataUrl) : new Blob();
        await this.writeSlotBlob(quizId, id, blob);
        return { updatedAt: new Date(meta.lastUpdate).getTime() };
      },
    };
  }

  /** リモートから取得したアセットBlobを、対応するクイズのローカルレコードへ書き戻す。 */
  private async writeSlotBlob(
    quizId: string,
    slotId: string,
    blob: Blob
  ): Promise<void> {
    const raw = await this.localStorage.get<any>(quizId);
    const existing = raw ? Quiz.fromDto(raw) : null;
    const parts = slotId.split("::");
    const type = parts[1] as AssetSlotType;

    const quiz =
      existing ??
      new Quiz({
        id: quizId,
        title: "",
        question: "",
        options: [],
        correctNo: 1,
        timeLimit: 0,
        bgm: null,
      });

    if (type === "bgm") {
      quiz.bgm = blob;
    } else if (type === "option") {
      const idx = Number(parts[2]);
      while (quiz.options.length <= idx) {
        quiz.options.push({ no: quiz.options.length + 1, text: "", color: "", image: null });
      }
      quiz.options[idx].image = blob;
    } else if (type === "prizeImage" || type === "prizeBgm") {
      quiz.settings = quiz.settings ?? {
        correctBgm: null,
        prizeImage: null,
        prizeName: "",
        prizeBgm: null,
      };
      if (type === "prizeImage") quiz.settings.prizeImage = blob;
      else quiz.settings.prizeBgm = blob;
    }

    await this.localStorage.save(quizId, quiz);
  }
}
