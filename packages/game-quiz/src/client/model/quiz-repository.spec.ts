import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FixedConcurrencyPolicy, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { createHashedBlobStore, StorageModule } from "@octopus/infrastructures/compositions";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { SyncRunner } from "@octopus/sync-engine";
import { QuizRepository } from "./quiz-repository";
import { Quiz } from "./quiz";
import { QUIZ_RECORD_FILE, quizRecordHashes } from "../../server/quiz-api-contract";

// jsdom + localforage では保存した Blob を読み戻すと本物の Blob ではなくなり FileReader で読めないので、データURL化だけ差し替える
vi.mock("@octopus/client-common/blob/blob-to-data-url", () => ({
  blobToDataUrl: async () => "data:image/png;base64,QUJD",
}));

/** サーバーの実装(ハッシュのファイル置き場と一覧の保存)をそのまま使う、メモリ上のサーバー。 */
function makeServer() {
  const store = createHashedBlobStore(StorageModule.Quiz);
  const deps = { storage: new InMemoryKeyValueStorage() };
  const api = {
    getRecord: async () => store.getRecord(deps, { fileName: QUIZ_RECORD_FILE }),
    saveRecord: async (a: { json: string }) => store.saveRecord(deps, { fileName: QUIZ_RECORD_FILE, json: a.json }, quizRecordHashes),
    existsBlobs: async (a: { hashes: string[] }) => store.exists(deps, a),
    putBlob: async (a: { hash: string; dataUrl: string }) => store.put(deps, a),
    getBlob: async (a: { hash: string }) => store.get(deps, a),
  };
  /** サーバーに残っているハッシュのファイルの数。 */
  const blobCount = async () => (await deps.storage.listByPrefix("quiz-game/assets/")).length;
  return { api, blobCount };
}

function makeQuiz(overrides: Partial<ConstructorParameters<typeof Quiz>[0]> = {}): Quiz {
  return new Quiz({
    id: "q1",
    title: "Quiz 1",
    question: "What?",
    options: [{ no: 1, text: "A", color: "red", image: null }],
    correctNo: 1,
    timeLimit: 30,
    bgm: null,
    ...overrides,
  } as any);
}

const img = (text: string) => new Blob([text], { type: "image/png" });

async function clearLocal() {
  await new LocalStorageService("quiz-game", "QuizData").clear();
  await new LocalStorageService("quiz-game-blobs", "Blobs").clear();
}

const runner = new SyncRunner(new FixedConcurrencyPolicy(5));
const sync = async (repo: QuizRepository) => {
  const results = (await runner.run(repo.listSyncTargets())).results;
  for (const r of results) expect(r.error).toBeUndefined();
  return results;
};

describe("QuizRepository", () => {
  let server: ReturnType<typeof makeServer>;
  let repo: QuizRepository;

  beforeEach(async () => {
    await clearLocal();
    server = makeServer();
    repo = new QuizRepository(server.api as any);
  });

  it("保存したクイズを読み戻せ、同じ id は置き換わる", async () => {
    await repo.saveQuiz(makeQuiz({ title: "A" }));
    await repo.saveQuiz(makeQuiz({ title: "B" }));
    await repo.saveQuiz(makeQuiz({ id: "q2" }));
    expect((await repo.getAllQuizzes()).map((q) => q.title)).toEqual(["B", "Quiz 1"]);
    expect((await repo.getQuizById("q1"))!.title).toBe("B");
    expect(await repo.getQuizById("nope")).toBeNull();
  });

  it("画像はハッシュで参照され、同期でサーバーにファイルが上がる(一覧より先)", async () => {
    await repo.saveQuiz(makeQuiz({ options: [{ no: 1, text: "A", color: "red", image: img("one") }], bgm: img("bgm") as any }));
    expect((await sync(repo)).map((r) => r.result)).toEqual(["pushed"]);
    expect(await server.blobCount()).toBe(2);
    const { json } = await server.api.getRecord();
    const data = JSON.parse(json!).data;
    expect(data[0].options[0].image).toMatch(/^[0-9a-f]{32}$/);
  });

  it("削除 → 同期で、サーバーの一覧からもファイルからも消え、再同期しても戻らない", async () => {
    for (const id of ["a", "b", "c"]) {
      await repo.saveQuiz(makeQuiz({ id, options: [{ no: 1, text: id, color: "red", image: img(`img-${id}`) }] }));
    }
    await sync(repo);
    expect(await server.blobCount()).toBe(3);

    // 同期を待たずに続けて全部消す
    for (const id of ["a", "b", "c"]) await repo.deleteQuiz(id);
    await sync(repo);

    expect(await repo.getAllQuizzes()).toEqual([]);
    expect(JSON.parse((await server.api.getRecord()).json!).data).toEqual([]);
    expect(await server.blobCount()).toBe(0);
    await sync(repo);
    expect(await repo.getAllQuizzes()).toEqual([]);
  });

  it("別の端末は、一覧を受け取ってクイズとファイルを取り込む。削除も次の同期で反映される", async () => {
    await repo.saveQuiz(makeQuiz({ id: "x", options: [{ no: 1, text: "A", color: "red", image: img("pic") }] }));
    await sync(repo);

    await clearLocal();
    const other = new QuizRepository(server.api as any);
    expect((await sync(other)).map((r) => r.result)).toEqual(["pulled"]);
    const pulled = await other.getQuizById("x");
    expect(pulled!.options[0].image).not.toBeNull();

    await other.deleteQuiz("x");
    await sync(other);
    await clearLocal();
    const third = new QuizRepository(server.api as any);
    await sync(third);
    expect(await third.getAllQuizzes()).toEqual([]);
    expect(await server.blobCount()).toBe(0);
  });

  it("サーバーにファイルだけが残っていても、クイズは作られない(ファイルから項目を作る道筋が無い)", async () => {
    await server.api.putBlob({ hash: "d".repeat(32), dataUrl: "data:image/png;base64,QUJD" });
    await sync(repo);
    expect(await repo.getAllQuizzes()).toEqual([]);
  });

  it("最後の1件を消して空にした一覧も、データなしとは区別されて同期される", async () => {
    await repo.saveQuiz(makeQuiz());
    await sync(repo);
    await repo.deleteQuiz("q1");
    expect((await sync(repo)).map((r) => r.result)).toEqual(["pushed"]);
    expect(JSON.parse((await server.api.getRecord()).json!).data).toEqual([]);
  });

  it("以前の形式のデータは使わずに消す", async () => {
    await new LocalStorageService("quiz-game", "QuizData").save("old", { id: "old", title: "古い" });
    expect(await repo.getAllQuizzes()).toEqual([]);
    expect([...(await new LocalStorageService("quiz-game", "QuizData").getAll()).keys()]).toEqual([]);
  });
});
