import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { getJsonBlob } from "../get-json-blob-use-case";

const JSON_FOLDER_PROPERTY = "quiz-game-json-folder";

describe("getJsonBlob", () => {
  it("returns an empty array with a null updatedAt when the folder property is not configured", async () => {
    const storage = new InMemoryKeyValueStorage();

    const result = await getJsonBlob({ storage });
    expect(result).toEqual({ json: "[]", updatedAt: null });
  });

  it("reads the default quizzes.json file and returns its updatedAt when no fileId is given", async () => {
    const storage = new InMemoryKeyValueStorage();
    await storage.set(JSON_FOLDER_PROPERTY, "folder-1");
    await storage.putText("folder-1/quizzes.json", JSON.stringify([{ id: "q1" }]), "application/json");

    const result = await getJsonBlob({ storage });
    expect(JSON.parse(result.json)).toEqual([{ id: "q1" }]);
    expect(result.updatedAt).not.toBeNull();
  });

  it("returns an empty array with a null updatedAt when the default file is missing", async () => {
    const storage = new InMemoryKeyValueStorage();
    await storage.set(JSON_FOLDER_PROPERTY, "folder-1");

    const result = await getJsonBlob({ storage });
    expect(result).toEqual({ json: "[]", updatedAt: null });
  });

  it("returns an empty array (still success) when the stored content is malformed JSON", async () => {
    const storage = new InMemoryKeyValueStorage();
    await storage.set(JSON_FOLDER_PROPERTY, "folder-1");
    await storage.putText("folder-1/quizzes.json", "{not valid json", "application/json");

    const result = await getJsonBlob({ storage });
    expect(JSON.parse(result.json)).toEqual([]);
    expect(result.updatedAt).not.toBeNull();
  });

  it("falls back to a filename-prefix match and returns that file's updatedAt when the given fileId is not a real key", async () => {
    const storage = new InMemoryKeyValueStorage();
    await storage.set(JSON_FOLDER_PROPERTY, "folder-1");
    await storage.putText(
      "folder-1/app-123_quizzes.json",
      JSON.stringify([{ id: "q2" }]),
      "application/json"
    );

    const result = await getJsonBlob({ storage }, "app-123");
    expect(JSON.parse(result.json)).toEqual([{ id: "q2" }]);
    expect(result.updatedAt).not.toBeNull();
  });
});
