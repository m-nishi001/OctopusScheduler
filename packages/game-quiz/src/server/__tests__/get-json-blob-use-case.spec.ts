import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { getJsonBlob } from "../get-json-blob-use-case";

const JSON_FOLDER_PROPERTY = "quiz-game-json-folder";

describe("getJsonBlob", () => {
  it("returns an empty array (still success) when the folder property is not configured", () => {
    const storage = new InMemoryKeyValueStorage();

    const result = getJsonBlob({ storage });
    expect(result).toEqual({ json: "[]" });
  });

  it("reads the default quizzes.json file when no fileId is given", () => {
    const storage = new InMemoryKeyValueStorage();
    storage.set(JSON_FOLDER_PROPERTY, "folder-1");
    storage.putText("folder-1/quizzes.json", JSON.stringify([{ id: "q1" }]), "application/json");

    const result = getJsonBlob({ storage });
    expect(JSON.parse(result.json)).toEqual([{ id: "q1" }]);
  });

  it("returns an empty array (still success) when the default file is missing", () => {
    const storage = new InMemoryKeyValueStorage();
    storage.set(JSON_FOLDER_PROPERTY, "folder-1");

    const result = getJsonBlob({ storage });
    expect(result).toEqual({ json: "[]" });
  });

  it("returns an empty array (still success) when the stored content is malformed JSON", () => {
    const storage = new InMemoryKeyValueStorage();
    storage.set(JSON_FOLDER_PROPERTY, "folder-1");
    storage.putText("folder-1/quizzes.json", "{not valid json", "application/json");

    const result = getJsonBlob({ storage });
    expect(result).toEqual({ json: "[]" });
  });

  it("falls back to a filename-prefix match when the given fileId is not a real key", () => {
    const storage = new InMemoryKeyValueStorage();
    storage.set(JSON_FOLDER_PROPERTY, "folder-1");
    storage.putText(
      "folder-1/app-123_quizzes.json",
      JSON.stringify([{ id: "q2" }]),
      "application/json"
    );

    const result = getJsonBlob({ storage }, "app-123");
    expect(JSON.parse(result.json)).toEqual([{ id: "q2" }]);
  });
});
