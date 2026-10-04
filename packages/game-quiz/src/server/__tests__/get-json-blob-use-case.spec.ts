import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { StorageKind, StorageModule, storagePath } from "@octopus/infrastructures/compositions";
import { getJsonBlob } from "../get-json-blob-use-case";

const DEFAULT_KEY = storagePath(StorageModule.Quiz, StorageKind.Json, "quizzes.json");

describe("getJsonBlob", () => {
  it("returns an empty array with a null updatedAt when nothing has ever been written", async () => {
    const storage = new InMemoryKeyValueStorage();

    const result = await getJsonBlob({ storage });
    expect(result).toEqual({ json: "[]", updatedAt: null });
  });

  it("reads the default quizzes.json file and returns its updatedAt when no fileId is given", async () => {
    const storage = new InMemoryKeyValueStorage();
    await storage.putText(DEFAULT_KEY, JSON.stringify([{ id: "q1" }]), "application/json");

    const result = await getJsonBlob({ storage });
    expect(JSON.parse(result.json)).toEqual([{ id: "q1" }]);
    expect(result.updatedAt).not.toBeNull();
  });

  it("returns an empty array with a null updatedAt when the default file is missing", async () => {
    const storage = new InMemoryKeyValueStorage();

    const result = await getJsonBlob({ storage });
    expect(result).toEqual({ json: "[]", updatedAt: null });
  });

  it("returns an empty array (still success) when the stored content is malformed JSON", async () => {
    const storage = new InMemoryKeyValueStorage();
    await storage.putText(DEFAULT_KEY, "{not valid json", "application/json");

    const result = await getJsonBlob({ storage });
    expect(JSON.parse(result.json)).toEqual([]);
    expect(result.updatedAt).not.toBeNull();
  });

  it("falls back to a filename-prefix match and returns that file's updatedAt when the given fileId is not a real key", async () => {
    const storage = new InMemoryKeyValueStorage();
    await storage.putText(
      storagePath(StorageModule.Quiz, StorageKind.Json, "app-123_quizzes.json"),
      JSON.stringify([{ id: "q2" }]),
      "application/json"
    );

    const result = await getJsonBlob({ storage }, "app-123");
    expect(JSON.parse(result.json)).toEqual([{ id: "q2" }]);
    expect(result.updatedAt).not.toBeNull();
  });
});
