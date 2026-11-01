import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { createHashedBlobStore, StorageModule } from "@octopus/infrastructures/compositions";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { readZip } from "@octopus/table-io";
import { QuizRepository } from "../../model/quiz-repository";
import { Quiz } from "../../model/quiz";
import { QUIZ_RECORD_FILE, quizRecordHashes } from "../../../server/quiz-api-contract";
import { hashBlob } from "@octopus/sync-engine";
import { exportQuizzes as exportFrom, previewQuizImport, quizTableIo } from "./quiz-table-io";

vi.mock("@octopus/client-common/blob/blob-to-data-url", () => ({
  blobToDataUrl: async () => "data:image/png;base64,QUJD",
}));

// jsdom の Blob には arrayBuffer が無い(ブラウザにはある)ので、FileReader で補う。
Blob.prototype.arrayBuffer ??= function (this: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(this);
  });
};

const store = createHashedBlobStore(StorageModule.Quiz);
const deps = { storage: new InMemoryKeyValueStorage() };
const api = {
  getRecord: async () => store.getRecord(deps, { fileName: QUIZ_RECORD_FILE }),
  saveRecord: async (a: { json: string }) => store.saveRecord(deps, { fileName: QUIZ_RECORD_FILE, json: a.json }, quizRecordHashes),
  existsBlobs: async (a: { hashes: string[] }) => store.exists(deps, a),
  putBlob: async (a: { hash: string; dataUrl: string }) => store.put(deps, a),
  getBlob: async (a: { hash: string }) => store.get(deps, a),
};

/** このテストで作ったファイル。jsdom では端末の置き場から読み戻した Blob が本物ではなくなるので、書き出しではここから返す。 */
const created: File[] = [];
const wav = (name: string, text: string) => {
  const file = new File([text], name, { type: "audio/wav" });
  created.push(file);
  return file;
};
const csvFile = (text: string, name = "quizzes.csv") => new File([text], name, { type: "text/csv" });
const makeQuiz = (id: string, bgm: File | null) =>
  new Quiz({ id, title: `Q${id}`, question: "?", options: [{ no: 1, text: "A", color: "red", image: null }], correctNo: 1, timeLimit: 30, bgm });

describe("クイズ一覧の書き出し・取込", () => {
  let repo: QuizRepository;
  const exportQuizzes = (r: QuizRepository, options: { includeMedia: boolean }) =>
    exportFrom(
      {
        readRecord: () => r.readRecord(),
        applyImport: (...args) => r.applyImport(...args),
        blobOf: async (hash) => {
          for (const f of created) if ((await hashBlob(f)) === hash) return f;
          return null;
        },
      },
      options
    );

  beforeEach(async () => {
    await new LocalStorageService("quiz-game", "QuizData").clear();
    await new LocalStorageService("quiz-game-blobs", "Blobs").clear();
    repo = new QuizRepository(api as any);
  });

  /** 10問が同じBGMを使う一覧を作る。 */
  async function seedShared() {
    for (let i = 1; i <= 10; i++) await repo.saveQuiz(makeQuiz(`q${i}`, wav("shared.wav", "BGMDATA")));
  }

  it("同じBGMを10問が使っていても、素材の索引は1つで、ZIP の素材も1つ", async () => {
    await seedShared();
    expect(Object.keys((await repo.readRecord()).media)).toEqual(["shared.wav"]);
    const out = await exportQuizzes(repo, { includeMedia: true });
    const zip = readZip(out.bytes);
    expect([...zip.media.keys()]).toEqual(["shared.wav"]);
    expect(out.filename).toBe("quizzes.zip");
    expect(out.missingMedia).toBe(0);
    expect(new TextDecoder().decode(zip.csv!).match(/shared\.wav/g)).toHaveLength(10);
  });

  it("CSV だけの書き出しは素材を含まない", async () => {
    await seedShared();
    const out = await exportQuizzes(repo, { includeMedia: false });
    expect(out.filename).toBe("quizzes.csv");
    expect(out.mime).toContain("text/csv");
  });

  it("書き出した ZIP をそのまま取り込むと、全行が変更なし。CSV だけでも同じ", async () => {
    await seedShared();
    const zip = await exportQuizzes(repo, { includeMedia: true });
    const p1 = await previewQuizImport({ table: new File([zip.bytes as BlobPart], "quizzes.zip"), media: [], mode: "replace" }, { repo });
    expect(p1).toMatchObject({ ok: true, counts: { unchanged: 10, add: 0, update: 0, delete: 0, error: 0 }, media: { added: 0, replaced: 0 } });
    const csv = await exportQuizzes(repo, { includeMedia: false });
    const p2 = await previewQuizImport({ table: csvFile(new TextDecoder().decode(csv.bytes)), media: [], mode: "replace" }, { repo });
    expect(p2).toMatchObject({ ok: true, counts: { unchanged: 10 } });
  });

  it("新しい行と素材を取り込むと、一覧は1回の書き込みで、素材は1つ", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => `,新${i},問${i},,,BGM.wav`).join("\n");
    const apply = vi.spyOn(repo, "applyImport");
    const preview = await previewQuizImport({ table: csvFile(`ID,タイトル,問題,制限時間,正解,BGM\n${rows}\n`), media: [wav("BGM.wav", "ONE")], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { add: 10 }, media: { added: 1, replaced: 0 } });
    if (!preview.ok) return;
    const result = await preview.apply(() => undefined);
    expect(result.summary).toBe("追加 10 / 更新 0 / 変更なし 0 / 削除 0");
    expect(apply).toHaveBeenCalledTimes(1);
    const record = await repo.readRecord();
    expect(record.quizzes).toHaveLength(10);
    expect(Object.keys(record.media)).toEqual(["BGM.wav"]);
  });

  it("エラーの行があると、取り込めない(反映もしない)", async () => {
    const preview = await previewQuizImport({ table: csvFile("ID,タイトル,問題,BGM\n,T,Q,missing.wav\n"), media: [], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { error: 1 } });
    if (!preview.ok) return;
    await expect(preview.apply(() => undefined)).rejects.toThrow();
    expect((await repo.readRecord()).quizzes).toEqual([]);
  });

  it("置き換えは、ファイルに無いクイズを消し、使われなくなった素材は索引から消える", async () => {
    await repo.saveQuiz(makeQuiz("keep", wav("keep.wav", "K")));
    await repo.saveQuiz(makeQuiz("drop", wav("drop.wav", "D")));
    const csv = (await exportQuizzes(repo, { includeMedia: false })).bytes;
    const onlyKeep = new TextDecoder().decode(csv).split("\r\n").filter((l) => !l.startsWith("drop,")).join("\r\n");
    const preview = await previewQuizImport({ table: csvFile(onlyKeep), media: [], mode: "replace" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { unchanged: 1, delete: 1 } });
    if (!preview.ok) return;
    await preview.apply(() => undefined);
    const record = await repo.readRecord();
    expect(record.quizzes.map((q) => q.id)).toEqual(["keep"]);
    expect(Object.keys(record.media)).toEqual(["keep.wav"]);
  });

  it("同じ名前で中身が違う素材は差し替えになり、それを使う行は更新になる(共有の素材はほかの行にも及ぶ)", async () => {
    await seedShared();
    const csv = new TextDecoder().decode((await exportQuizzes(repo, { includeMedia: false })).bytes);
    const preview = await previewQuizImport({ table: csvFile(csv), media: [wav("shared.wav", "CHANGED!")], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { update: 10, unchanged: 0 }, media: { added: 0, replaced: 1 } });
    if (!preview.ok) return;
    await preview.apply(() => undefined);
    const { media } = await repo.readRecord();
    expect(media["shared.wav"].size).toBe(8);
    expect(Object.keys(media)).toEqual(["shared.wav"]);
  });

  it("取込を確定すると afterImport が呼ばれる。書き出しは保存の関数に渡され、素材が手元に無ければ警告", async () => {
    const afterImport = vi.fn(async () => undefined);
    const save = vi.fn();
    const warn = vi.fn();
    const io = quizTableIo({ repo, afterImport, save, warn });
    const preview = await io.onPreviewImport({ table: csvFile("ID,タイトル,問題\n,T,Q\n"), media: [], mode: "upsert" });
    if (!preview.ok) throw new Error("preview");
    await preview.apply(() => undefined);
    expect(afterImport).toHaveBeenCalledOnce();
    await io.onExport({ includeMedia: false });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ filename: "quizzes.csv" }));
    expect(warn).not.toHaveBeenCalled();
  });

  it("CSV でも ZIP でもないファイルは、プレビューの段階でエラーを返す", async () => {
    expect(await previewQuizImport({ table: new File(["not a zip"], "x.zip"), media: [], mode: "upsert" }, { repo })).toMatchObject({ ok: false });
    expect(await previewQuizImport({ table: csvFile("ID,名前\n1,a\n"), media: [], mode: "upsert" }, { repo })).toMatchObject({ ok: false });
  });
});
