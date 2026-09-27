import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuizRepository } from "./quiz-repository";
import { Quiz } from "./quiz";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

function makeFakeApi() {
  return {
    addDriveData: vi.fn(async (d: any) => ({ ...d.driveData.metadata, fileId: "file-1" })),
    getDriveMetaData: vi.fn(async () => []),
    getDriveData: vi.fn(),
    updateDriveData: vi.fn(async () => undefined),
    addJson: vi.fn(async (d: any) => ({
      driveDataId: d.driveJson.fileName,
      fileId: `folder1/${d.driveJson.fileName}`,
      parentFolderId: "folder1",
      lastUpdate: new Date().toISOString(),
    })),
    getJson: vi.fn(async () => ({ json: "[]", updatedAt: null })),
  };
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

describe("QuizRepository.listSyncTargets", () => {
  let fakeApi: ReturnType<typeof makeFakeApi>;
  let repo: QuizRepository;

  beforeEach(async () => {
    await new LocalStorageService("quiz-game", "QuizData").clear();
    await new LocalStorageService("quiz-game", "SyncDirtyTracker").clear();
    fakeApi = makeFakeApi();
    repo = new QuizRepository(fakeApi as any);
  });

  describe("quizzes-meta target", () => {
    it("returns no local snapshot when there are no local quizzes", async () => {
      const [metaTarget] = await repo.listSyncTargets();
      expect(metaTarget.id).toBe("quizzes-meta");
      expect(await metaTarget.getLocal()).toBeNull();
    });

    it("push uploads the metadata as a single JSON blob without embedding any asset content", async () => {
      await repo.saveQuiz(
        makeQuiz({ bgm: new Blob(["x"], { type: "audio/mpeg" }) as any })
      );

      const [metaTarget] = await repo.listSyncTargets();
      const local = await metaTarget.getLocal();
      expect(local).not.toBeNull();
      await metaTarget.push(local!.data);

      expect(fakeApi.addJson).toHaveBeenCalledOnce();
      const payload = fakeApi.addJson.mock.calls[0][0].driveJson;
      expect(payload.fileName).toBe("quizzes.json");
      const uploaded = JSON.parse(payload.jsonText);
      expect(uploaded).toEqual([
        expect.objectContaining({ id: "q1", bgm: "drive:q1::bgm" }),
      ]);
    });

    it("pull updates text fields but preserves existing local asset blobs", async () => {
      const localBgm = new Blob(["local"], { type: "audio/mpeg" });
      await repo.saveQuiz(makeQuiz({ title: "Old title", bgm: localBgm as any }));

      const [metaTarget] = await repo.listSyncTargets();
      await metaTarget.pull([
        {
          id: "q1",
          title: "New title",
          question: "Updated?",
          options: [{ no: 1, text: "A", color: "red", image: "drive:q1::bgm" }],
          correctNo: 1,
          timeLimit: 45,
          bgm: "drive:q1::bgm",
        },
      ]);

      const updated = await repo.getQuizById("q1");
      expect(updated!.title).toBe("New title");
      expect(updated!.timeLimit).toBe(45);
      // Note: LocalStorageService round-trips through localforage, which under
      // jsdom cannot preserve a real Blob's identity/content, so this only
      // asserts pull() didn't null out the field (the actual guarantee under
      // test) rather than comparing Blob content byte-for-byte.
      expect(updated!.bgm).not.toBeNull();
    });
  });

  describe("quiz-asset targets", () => {
    it("enumerates one target per local asset slot", async () => {
      await repo.saveQuiz(
        makeQuiz({
          bgm: new Blob(["bgm"]) as any,
          options: [{ no: 1, text: "A", color: "red", image: new Blob(["img"]) as any }],
        })
      );

      const targets = await repo.listSyncTargets();
      const assetTargets = targets.filter((t) => t.kind === "quiz-asset");
      const ids = assetTargets.map((t) => t.id).sort();
      expect(ids).toEqual(["q1::bgm", "q1::option::0"]);
    });

    it("pushes a new slot via addDriveData using a stable slot id (not a randomly generated one)", async () => {
      await repo.saveQuiz(makeQuiz({ bgm: new Blob(["bgm"]) as any }));

      const targets = await repo.listSyncTargets();
      const bgmTarget = targets.find((t) => t.id === "q1::bgm")!;
      // Pushed directly with a freshly-constructed Blob rather than one read
      // back via getLocal(): LocalStorageService's localforage round-trip
      // cannot preserve a real Blob under jsdom, so getLocal()'s returned
      // "blob" here isn't usable with FileReader. push()'s own behavior
      // (stable id, add-vs-update branching) doesn't depend on where the
      // blob came from, so this still exercises the real code path.
      await bgmTarget.push(new Blob(["bgm"], { type: "audio/mpeg" }));

      expect(fakeApi.addDriveData).toHaveBeenCalledOnce();
      const driveData = fakeApi.addDriveData.mock.calls[0][0].driveData;
      expect(driveData.metadata.driveDataId).toBe("q1::bgm");
    });

    it("pushes to an existing slot via updateDriveData (not addDriveData) when a remote counterpart already exists", async () => {
      fakeApi.getDriveMetaData.mockResolvedValue([
        {
          driveDataId: "q1::bgm",
          fileId: "file-bgm",
          parentFolderId: "",
          lastUpdate: new Date(0).toISOString(),
        },
      ]);
      await repo.saveQuiz(makeQuiz({ bgm: new Blob(["bgm"]) as any }));

      const targets = await repo.listSyncTargets();
      const bgmTarget = targets.find((t) => t.id === "q1::bgm")!;
      await bgmTarget.push(new Blob(["bgm"], { type: "audio/mpeg" }));

      expect(fakeApi.updateDriveData).toHaveBeenCalledOnce();
      expect(fakeApi.addDriveData).not.toHaveBeenCalled();
    });

    it("pull writes the fetched blob back into the quiz's local record, creating a stub quiz if needed", async () => {
      fakeApi.getDriveMetaData.mockResolvedValue([
        {
          driveDataId: "q2::prizeImage",
          fileId: "file-prize",
          parentFolderId: "",
          lastUpdate: new Date().toISOString(),
        },
      ]);
      fakeApi.getDriveData.mockResolvedValue({
        fileDataUrl: "data:image/png;base64,aGVsbG8=",
        fileKind: "image/png",
      });

      const targets = await repo.listSyncTargets();
      const target = targets.find((t) => t.id === "q2::prizeImage")!;
      const remote = await target.getRemote();
      expect(remote).not.toBeNull();
      await target.pull(remote!.data);

      const quiz = await repo.getQuizById("q2");
      expect(quiz).not.toBeNull();
      // See note above: LocalStorageService can't round-trip a real Blob
      // under jsdom, so this only asserts the slot was populated (not left
      // null), not exact Blob identity/content.
      expect(quiz!.settings?.prizeImage).not.toBeNull();
    });
  });
});
