import { blobToDataUrl } from "@octopus/client-common/blob/blob-to-data-url";
import { inject, injectable } from "tsyringe";
import { Quiz, normalizeCorrectNo } from "./quiz";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { BlobRecordStore, blobRecordSyncTarget, textBlobRecordRemote } from "@octopus/sync-engine";
import type { BlobRecordLocalStore, SyncTarget } from "@octopus/sync-engine";
import { IQuizGameApiToken } from "../../server/quiz-api-contract";
import type { QuizGameApi, QuizWithDataUrl } from "../../server/quiz-api-contract";
import { dataUrlToBlob } from "./blob-utils";
import type { DriveMetadata } from "@octopus/infrastructures/compositions";

const METADATA_SYNC_KIND = "quizzes-meta";
const METADATA_FILE_NAME = "quizzes.json";
const ASSET_SYNC_KIND = "quiz-asset";

type AssetSlotType = "bgm" | "option" | "prizeImage" | "prizeBgm";

/** クイズの保存先。この端末(IndexedDB)に持ち、バックグラウンド同期の対象として Drive / R2 と差分をやり取りする。画像・音声は `drive:<slotId>` の参照で持つ。 */
@injectable()
export class QuizRepository {
  private readonly localStorage = new LocalStorageService(
    "quiz-game",
    "QuizData"
  );
  /** クイズ一覧(同期の対象)の最終更新日時。データは持たず、一覧の編集のたびに更新日時だけを進める(一覧そのものは QuizData から作る)。 */
  private readonly metaStamp = new BlobRecordStore<null>("quiz-game", "QuizMetaStamp");

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
    await this.metaStamp.update(() => null);
    eventBus.emit("syncDirty");
  }

  async addQuiz(quiz: Omit<Quiz, "id">): Promise<string> {
    const id = crypto.randomUUID();
    const newQuiz: Quiz = { ...quiz, id };
    await this.localStorage.save(id, newQuiz);
    await this.metaStamp.update(() => null);
    eventBus.emit("syncDirty");
    return id;
  }

  async deleteQuiz(id: string): Promise<void> {
    await this.localStorage.delete(id);
    await this.metaStamp.update(() => null);
    eventBus.emit("syncDirty");
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
      this.buildQuizzesMetaTarget(),
      ...(await this.buildAssetTargets(remoteAssetMap)),
    ];
    return targets;
  }

  /**
   * クイズ一覧のメタデータ(1つのレコード `{ data, updatedAt }`)。データは QuizData のクイズから作り、
   * 更新日時だけを別に持つ(クイズ1件ごとのレコードは、画像を中に持つのでそのまま残す)。
   */
  private buildQuizzesMetaTarget(): SyncTarget<QuizWithDataUrl[], QuizWithDataUrl[]> {
    const local: BlobRecordLocalStore<QuizWithDataUrl[]> = {
      read: async () => {
        const stamp = await this.metaStamp.read();
        const quizzes = await this.getAllQuizzes();
        // 一度も編集していない(更新日時が無い)端末は、クイズがあれば更新日時 0(リモートがあればそちらを取り込む)、無ければデータなし
        if (!stamp && quizzes.length === 0) return null;
        return { data: quizzes.map((q) => this.toWireEntry(q)), updatedAt: stamp?.updatedAt ?? 0 };
      },
      replaceIfUnchanged: async (expectedUpdatedAt, next) => {
        // 更新日時 0 は「更新日時が無いまま読んだ」(上の read)ので、更新日時の記録としては「無い」(null)
        const expectedStamp = expectedUpdatedAt === 0 ? null : expectedUpdatedAt;
        if (!(await this.metaStamp.replaceIfUnchanged(expectedStamp, { data: null, updatedAt: next.updatedAt }))) {
          return false;
        }
        await this.applyRemoteQuizzes(next.data);
        return true;
      },
    };
    return blobRecordSyncTarget(
      METADATA_SYNC_KIND,
      local,
      textBlobRecordRemote<QuizWithDataUrl[]>({
        read: async () => (await this.quizApi.getJson({ fileName: METADATA_FILE_NAME })).json,
        write: (json) => this.quizApi.addJson({ fileName: METADATA_FILE_NAME, json }),
      })
    );
  }

  /** リモートの一覧に合わせてローカルのクイズを反映する(一覧に無いクイズは消す)。 */
  private async applyRemoteQuizzes(entries: QuizWithDataUrl[]): Promise<void> {
    const keep = new Set(entries.map((e) => e.id));
    const stale = Array.from((await this.localStorage.getAll<any>()).keys()).filter((id) => !keep.has(id));
    if (stale.length) await this.localStorage.removeMultiple(stale);
    for (const entry of entries) await this.upsertQuizMetadata(entry);
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
    const options = entry.options.map((o, idx) => ({
      no: o.no,
      text: o.text,
      color: o.color,
      image: existing?.options[idx]?.image ?? null,
    }));
    const { correctNo } = normalizeCorrectNo({ options, correctNo: entry.correctNo });
    const quiz = new Quiz({
      id: entry.id,
      title: entry.title,
      question: entry.question,
      options,
      correctNo,
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
      push: async ({ data: blob }) => {
        const dataUrl = await blobToDataUrl(blob);
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
        // 更新日時はサーバーの時刻を採る(端末の時計がずれていても、リモートとの新旧比較が狂わないように)
        if (remoteAssetMap.has(id)) await this.quizApi.updateDriveData({ driveData });
        else await this.quizApi.addDriveData({ driveData });
      },
      pull: async ({ data: meta }) => {
        const data = await this.quizApi.getDriveData({ dataId: meta.fileId });
        const blob = data?.fileDataUrl ? dataUrlToBlob(data.fileDataUrl) : new Blob();
        await this.writeSlotBlob(quizId, id, blob);
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
