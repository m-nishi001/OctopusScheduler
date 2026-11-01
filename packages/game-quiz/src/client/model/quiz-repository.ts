import { blobToDataUrl } from "@octopus/client-common/blob/blob-to-data-url";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { inject, injectable } from "tsyringe";
import {
  BLOB_HASH_PATTERN,
  BlobRecordStore,
  HashedBlobStore,
  blobRecordSyncTarget,
  hashBlob,
  mapPool,
  textBlobRecordRemote,
  withHashedBlobs,
} from "@octopus/sync-engine";
import type { HashedBlobRemote, SyncTarget } from "@octopus/sync-engine";
import { deriveMedia, extensionOfMime } from "@octopus/table-io";
import { IQuizGameApiToken, quizMediaNames, quizRecordHashes } from "../../server/quiz-api-contract";
import type { QuizGameApi, QuizMediaInfo, QuizRecord, QuizRecordEntry } from "../../server/quiz-api-contract";
import { dataUrlToBlob } from "./blob-utils";
import { Quiz } from "./quiz";

const RECORD_SYNC_KIND = "quizzes";

/** 取り込む素材1つ: 中身とそのハッシュ(`hashBlob`)。 */
export interface ImportedFile {
  blob: Blob;
  hash: string;
}

const emptyRecord = (): QuizRecord => ({ quizzes: [], media: {} });

/** 端末やサーバーに残っている一覧の形が違っても(以前の形式など)、空の一覧として扱う。 */
const asRecord = (data: Partial<QuizRecord> | null | undefined): QuizRecord =>
  data && Array.isArray(data.quizzes) ? { quizzes: data.quizzes, media: data.media ?? {} } : emptyRecord();

/**
 * クイズの保存先。正となるのは、この端末(IndexedDB)の「クイズの一覧1件」(`{ data, updatedAt }`)だけ。
 * 一覧 `data` は `{ quizzes, media }`。画像・音声はクイズからファイル名(素材の名前)で参照し、同じ名前は同じ素材として1つだけ持つ。
 * `media`(名前 → ハッシュなど)は状態として持たず、一覧を書くたびにクイズが参照している名前から作り直す(`commit` が唯一の書き込み)。
 * 素材の中身はハッシュを名前にした別の置き場に置く。削除は一覧から外すだけで、サーバーが一覧を書くときに、外れたハッシュのファイルを消す。
 * 一覧が正なので、ファイルだけがあってクイズが無い、参照先が無い、という状態は作れない。
 * 一覧は以前のクイズの行と同じ保存先(`QuizData`)に、ファイルは別のデータベースに置く(既存のデータベースにストアを足さない)。
 */
@injectable()
export class QuizRepository {
  private readonly list = new BlobRecordStore<QuizRecord>("quiz-game", "QuizData");
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

  /** いまの一覧(クイズと素材の索引)。 */
  async readRecord(): Promise<QuizRecord> {
    await this.clearLegacy();
    return asRecord((await this.list.read())?.data);
  }

  /** 素材の中身(ハッシュで引く)。まだ手元に無ければ null。 */
  blobOf(hash: string): Promise<Blob | null> {
    return this.blobs.get(hash);
  }

  async getQuizById(id: string): Promise<Quiz | null> {
    return (await this.getAllQuizzes()).find((q) => q.id === id) ?? null;
  }

  async getAllQuizzes(): Promise<Quiz[]> {
    const { quizzes, media } = await this.readRecord();
    return Promise.all(quizzes.map((entry) => this.fromEntry(entry, media)));
  }

  /** 一覧を書く唯一の場所。クイズの並びを `change` で変え、素材の索引を作り直す(参照先が無ければ書かずに例外)。 */
  private async commit(
    change: (quizzes: QuizRecordEntry[]) => QuizRecordEntry[],
    added: ReadonlyMap<string, QuizMediaInfo> = new Map()
  ): Promise<void> {
    await this.clearLegacy();
    await this.list.update((current) => {
      const record = asRecord(current);
      const quizzes = change(record.quizzes);
      const known = new Map([...Object.entries(record.media), ...added]);
      return { quizzes, media: deriveMedia(quizzes, quizMediaNames, known) };
    });
    eventBus.emit("syncDirty");
  }

  /** 保存する(同じ id があれば置き換え、無ければ末尾に足す)。 */
  async saveQuiz(quiz: Quiz): Promise<void> {
    const { entry, staged } = await this.toEntry(quiz);
    await this.commit((all) => (all.some((e) => e.id === entry.id) ? all.map((e) => (e.id === entry.id ? entry : e)) : [...all, entry]), staged);
  }

  async addQuiz(quiz: Omit<Quiz, "id">): Promise<string> {
    const id = crypto.randomUUID();
    await this.saveQuiz(new Quiz({ ...quiz, id }));
    return id;
  }

  async deleteQuizzes(ids: readonly string[]): Promise<void> {
    const gone = new Set(ids);
    await this.commit((all) => all.filter((e) => !gone.has(e.id)));
  }

  /**
   * 取り込みを反映する: 新しい素材を端末の置き場に並列に入れ、一覧を1回だけ書く(`next` が取込後のクイズの全部)。
   * 送信は通常の同期に任せる(上げてから一覧を書くので、途中までの状態がサーバーに出ることはない)。
   */
  async applyImport(next: readonly QuizRecordEntry[], newFiles: ReadonlyMap<string, ImportedFile>): Promise<void> {
    const used = new Set(next.flatMap(quizMediaNames));
    const files = [...newFiles].filter(([name]) => used.has(name));
    await mapPool(files, ([, f]) => this.blobs.put(f.hash, f.blob));
    const staged = new Map(files.map(([name, f]) => [name, { hash: f.hash, mime: f.blob.type, size: f.blob.size }] as const));
    await this.commit(() => [...next], staged);
  }

  /** 同期の対象。一覧1件と、それが参照するファイル(上げる → 一覧 → 取ってくる)。 */
  listSyncTargets(): SyncTarget[] {
    const record = blobRecordSyncTarget(
      RECORD_SYNC_KIND,
      this.list,
      textBlobRecordRemote<QuizRecord>({
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

  /**
   * クイズを一覧の1件にする。ファイルは置き場に入れ、名前(`File` ならそのファイル名)で参照する。
   * 同じクイズの中で、同じ名前の別のファイルがあれば例外。
   */
  private async toEntry(q: Quiz): Promise<{ entry: QuizRecordEntry; staged: Map<string, QuizMediaInfo> }> {
    const staged = new Map<string, QuizMediaInfo>();
    const refOf = async (blob: Blob | null | undefined): Promise<string | null> => {
      if (!blob) return null;
      const hash = await hashBlob(blob);
      const name = blob instanceof File && blob.name ? blob.name : `${hash}${extensionOfMime(blob.type)}`;
      const prev = staged.get(name);
      if (prev && prev.hash !== hash) throw new Error(`同じ名前「${name}」の別のファイルが、1つのクイズに含まれています`);
      await this.blobs.put(hash, blob);
      staged.set(name, { hash, mime: blob.type, size: blob.size });
      return name;
    };
    const s = q.settings;
    const entry: QuizRecordEntry = {
      id: q.id,
      title: q.title,
      question: q.question,
      options: await Promise.all(q.options.map(async (o) => ({ no: o.no, text: o.text, color: o.color, image: await refOf(o.image) }))),
      correctNo: q.correctNo,
      timeLimit: q.timeLimit,
      bgm: await refOf(q.bgm),
      settings: s
        ? {
            correctBgm: await refOf(s.correctBgm),
            prizeImage: await refOf(s.prizeImage),
            prizeName: s.prizeName ?? "",
            prizeBgm: await refOf(s.prizeBgm),
          }
        : undefined,
    };
    return { entry, staged };
  }

  /** まだ手元に無いファイル(同期の途中)は null のまま返す。ファイルは名前を持つ `File` で返す(保存し直しても同じ名前で参照される)。 */
  private async fromEntry(e: QuizRecordEntry, media: Readonly<Record<string, QuizMediaInfo>>): Promise<Quiz> {
    const blobOf = async (name: string | null | undefined): Promise<Blob | null> => {
      const info = name ? media[name] : undefined;
      const blob = info ? await this.blobs.get(info.hash) : null;
      return blob ? new File([blob], name!, { type: info!.mime || blob.type }) : null;
    };
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
