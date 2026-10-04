import { describe, it, expect } from "vitest";
import { StorageKind, StorageModule, storageNamespace, storagePath } from "../storage-paths";
import { encodeLocalName, splitKey } from "../item-key-naming";

describe("storage-paths", () => {
  it("builds the namespace and path in <module>/<kind>/<name> form", () => {
    expect(storageNamespace(StorageModule.Jackpot, StorageKind.Json)).toBe("jackpot-game/json");
    expect(storagePath(StorageModule.Quiz, StorageKind.Json, "quizzes.json")).toBe(
      "quiz-game/json/quizzes.json"
    );
  });

  it.each(["", ".", "..", "a/b"])("rejects invalid segment %j", (segment) => {
    expect(() => storagePath(StorageModule.Scheduler, StorageKind.Assets, segment)).toThrow(
      /Invalid storage path segment/
    );
  });

  it("splits a key at the last slash", () => {
    expect(splitKey("octopus-scheduler/assets/1_a.png")).toEqual({
      namespace: "octopus-scheduler/assets",
      localName: "1_a.png",
    });
  });

  it("never lets a display name introduce a path separator", () => {
    expect(encodeLocalName("1", "a/b.png")).toBe("1_a_b.png");
  });
});
