import { blobToDataUrl } from "@octopus/client-common/blob/blob-to-data-url";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { inject, injectable } from "tsyringe";
import {
  BLOB_HASH_PATTERN,
  BlobRecordStore,
  HashedBlobStore,
  blobRecordSyncTarget,
  hashBlob,
  textBlobRecordRemote,
  withHashedBlobs,
} from "@octopus/sync-engine";
import type { HashedBlobRemote, SyncTarget } from "@octopus/sync-engine";
import { IQuizGameApiToken, quizRecordHashes } from "../../server/quiz-api-contract";
import type { QuizGameApi, QuizRecordEntry } from "../../server/quiz-api-contract";
import { dataUrlToBlob } from "./blob-utils";
import { Quiz } from "./quiz";

const RECORD_SYNC_KIND = "quizzes";

/**
 * クイズの保存先。正となるのは、この端末(IndexedDB)の「クイズの一覧1件」(`{ data, updatedAt }`)だけ。
 * 画像・音声は内容のハッシュで一覧から参照する、中身の変わらないファイル(別の置き場)。
 * 削除は一覧から外すだけで、サーバーが一覧を書くときに、外れたハッシュのファイルを消す。
 * 一覧が正なので、ファイルだけがあってクイズが無い、という状態は作れない。
 * 一覧は以前のクイズの行と同じ保存先(`QuizData`)に、ファイルは別のデータベースに置く(既存のデータベースにストアを足さない)。
 */
@injectable()
export class QuizRepository {
  private readonly list = new BlobRecordStore<QuizRecordEntry[]>("quiz-game", "QuizData");
  private readonly blobs = new HashedBlobStore("quiz-game-blobs", "Blobs");
  private legacyCleared: Promise<void> | null = null;

  constructor(
    @inject(IQuizGameApiToken) private readonly quizApi: QuizGameApi
  ) {}

  /** 以前の形式(クイズ1件ずつの行)のデータを、(初回だけ)使わずに消す。移行はしない。 */
  private clearLegacy(): Promise<void> {
    this.legacyCleared ??= this.list.purgeOtherRows().catch((e) => console.warn("[QuizRepository] failed to clear legacy rows", e));
    return this.legacyCleared;
  }

  async getQuizById(id: string): Promise<Quiz | null> {
    return (await this.getAllQuizzes()).find((q) => q.id === id) ?? null;
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    await this.clearLegacy();
    const record = await this.list.read();
    return Promise.all((record?.data ?? []).map((entry) => this.fromEntry(entry)));
  }

  /** 保存する(同じ id があれば置き換え、無ければ末尾に足す)。 */
  async saveQuiz(quiz: Quiz): Promise<void> {
    await this.clearLegacy();
    const entry = await this.toEntry(quiz);
    await this.list.update((current) => {
      const all = current ?? [];
      return all.some((e) => e.id === entry.id) ? all.map((e) => (e.id === entry.id ? entry : e)) : [...all, entry];
    });
    eventBus.emit("syncDirty");
  }

  async addQuiz(quiz: Omit<Quiz, "id">): Promise<string> {
    const id = crypto.randomUUID();
    await this.saveQuiz(new Quiz({ ...quiz, id }));
    return id;
  }

  async deleteQuiz(id: string): Promise<void> {
    await this.clearLegacy();
    await this.list.update((current) => (current ?? []).filter((e) => e.id !== id));
    eventBus.emit("syncDirty");
  }

  /** 同期の対象。一覧1件と、それが参照するファイル(上げる → 一覧 → 取ってくる)。 */
  listSyncTargets(): SyncTarget[] {
    const record = blobRecordSyncTarget(
      RECORD_SYNC_KIND,
      this.list,
      textBlobRecordRemote<QuizRecordEntry[]>({
        read: async () => (await this.quizApi.getRecord({})).json,
        write: (json) => this.quizApi.saveRecord({ json }),
      })
    );
    return [
      withHashedBlobs(record, {
        local: this.blobs,
        remote: this.blobRemote(),
        hashesOf: (data) => quizRecordHashes(data).filter((h) => BLOB_HASH_PATTERN.test(h)),
      }) as SyncTarget,
    ];
  }

  private blobRemote(): HashedBlobRemote {
    return {
      exists: async (hashes) => (await this.quizApi.existsBlobs({ hashes })).existing,
      put: async (hash, blob) => this.quizApi.putBlob({ hash, dataUrl: await blobToDataUrl(blob) }),
      get: async (hash) => {
        const { dataUrl } = await this.quizApi.getBlob({ hash });
        return dataUrl ? dataUrlToBlob(dataUrl) : null;
      },
    };
  }

  /** ファイルを置き場に入れ、そのハッシュを返す(無ければ null)。 */
  private async refOf(blob: Blob | null | undefined): Promise<string | null> {
    if (!blob) return null;
    const hash = await hashBlob(blob);
    await this.blobs.put(hash, blob);
    return hash;
  }

  private async toEntry(q: Quiz): Promise<QuizRecordEntry> {
    const s = q.settings;
    return {
      id: q.id,
      title: q.title,
      question: q.question,
      options: await Promise.all(
        q.options.map(async (o) => ({ no: o.no, text: o.text, color: o.color, image: await this.refOf(o.image) }))
      ),
      correctNo: q.correctNo,
      timeLimit: q.timeLimit,
      bgm: await this.refOf(q.bgm),
      settings: s
        ? {
            correctBgm: await this.refOf(s.correctBgm),
            prizeImage: await this.refOf(s.prizeImage),
            prizeName: s.prizeName ?? "",
            prizeBgm: await this.refOf(s.prizeBgm),
          }
        : undefined,
    };
  }

  /** まだ手元に無いファイル(同期の途中)は null のまま返す。 */
  private async fromEntry(e: QuizRecordEntry): Promise<Quiz> {
    const blobOf = (hash: string | null | undefined): Promise<Blob | null> =>
      hash ? this.blobs.get(hash) : Promise.resolve(null);
    const s = e.settings;
    return new Quiz({
      id: e.id,
      title: e.title,
      question: e.question,
      options: await Promise.all(
        e.options.map(async (o) => ({ no: o.no, text: o.text, color: o.color, image: await blobOf(o.image) }))
      ),
      correctNo: e.correctNo,
      timeLimit: e.timeLimit,
      bgm: await blobOf(e.bgm),
      settings: s
        ? {
            correctBgm: await blobOf(s.correctBgm),
            prizeImage: await blobOf(s.prizeImage),
            prizeName: s.prizeName,
            prizeBgm: await blobOf(s.prizeBgm),
          }
        : undefined,
    });
  }
}
