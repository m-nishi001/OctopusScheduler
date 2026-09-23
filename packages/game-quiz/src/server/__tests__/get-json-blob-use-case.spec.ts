import { describe, it, expect } from "vitest";
import { InMemoryFileStorageRepository } from "./fakes/in-memory-file-storage-repository";
import { InMemoryKeyValueRepository } from "./fakes/in-memory-key-value-repository";
import { getJsonBlob } from "../get-json-blob-use-case";

const JSON_FOLDER_PROPERTY = "quiz-game-json-folder";

describe("getJsonBlob", () => {
  it("returns an empty array (still success) when the folder property is not configured", () => {
    const fileStorage = new InMemoryFileStorageRepository();
    const kv = new InMemoryKeyValueRepository();

    const result = getJsonBlob({ fileStorage, kv });
    expect(result).toEqual({ json: "[]" });
  });

  it("reads the default quizzes.json file when no fileId is given", () => {
    const fileStorage = new InMemoryFileStorageRepository();
    const kv = new InMemoryKeyValueRepository();
    kv.set(JSON_FOLDER_PROPERTY, "folder-1");
    fileStorage.createTextFile({
      folderId: "folder-1",
      fileName: "quizzes.json",
      mimeType: "application/json",
      content: JSON.stringify([{ id: "q1" }]),
    });

    const result = getJsonBlob({ fileStorage, kv });
    expect(JSON.parse(result.json)).toEqual([{ id: "q1" }]);
  });

  it("returns an empty array (still success) when the default file is missing", () => {
    const fileStorage = new InMemoryFileStorageRepository();
    const kv = new InMemoryKeyValueRepository();
    kv.set(JSON_FOLDER_PROPERTY, "folder-1");

    const result = getJsonBlob({ fileStorage, kv });
    expect(result).toEqual({ json: "[]" });
  });

  it("returns an empty array (still success) when the stored content is malformed JSON", () => {
    const fileStorage = new InMemoryFileStorageRepository();
    const kv = new InMemoryKeyValueRepository();
    kv.set(JSON_FOLDER_PROPERTY, "folder-1");
    fileStorage.createTextFile({
      folderId: "folder-1",
      fileName: "quizzes.json",
      mimeType: "application/json",
      content: "{not valid json",
    });

    const result = getJsonBlob({ fileStorage, kv });
    expect(result).toEqual({ json: "[]" });
  });

  it("falls back to a filename-prefix match when the given fileId is not a real Drive id", () => {
    const fileStorage = new InMemoryFileStorageRepository();
    const kv = new InMemoryKeyValueRepository();
    kv.set(JSON_FOLDER_PROPERTY, "folder-1");
    fileStorage.createTextFile({
      folderId: "folder-1",
      fileName: "app-123_quizzes.json",
      mimeType: "application/json",
      content: JSON.stringify([{ id: "q2" }]),
    });

    const result = getJsonBlob({ fileStorage, kv }, "app-123");
    expect(JSON.parse(result.json)).toEqual([{ id: "q2" }]);
  });
});
