import { describe, it, expect } from "vitest";
import { InMemoryFormRepository } from "./fakes/in-memory-form-repository";
import { InMemoryCacheRepository } from "./fakes/in-memory-cache-repository";
import { InMemoryKeyValueRepository } from "./fakes/in-memory-key-value-repository";
import { createInMemoryRecordStoreRepositories } from "./fakes/in-memory-record-store-repository";
import { getMappedResponses } from "../get-mapped-responses-use-case";

describe("getMappedResponses", () => {
  it("detects Japanese header names and maps emails to names via the email-name map", () => {
    const form = new InMemoryFormRepository();
    form.setDestination("form-1", "sheet-1");
    const cache = new InMemoryCacheRepository();
    const kv = new InMemoryKeyValueRepository();
    const { factory } = createInMemoryRecordStoreRepositories();
    factory("sheet-1").replaceCollection("Sheet1", [
      ["タイムスタンプ", "メールアドレス", "回答"],
      [new Date("2024-01-01T00:00:00Z"), "player@example.com", "42"],
    ]);

    cache.put(
      "quiz-email-name-map",
      JSON.stringify({ "player@example.com": "Alice" }),
      3600
    );

    const rows = getMappedResponses({ form, recordStoreFactory: factory, cache, kv }, "form-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Alice");
    expect(rows[0].__timestampMs).toBe(new Date("2024-01-01T00:00:00Z").getTime());
  });

  it("throws when the form has no linked destination spreadsheet", () => {
    const form = new InMemoryFormRepository();
    const cache = new InMemoryCacheRepository();
    const kv = new InMemoryKeyValueRepository();
    const { factory } = createInMemoryRecordStoreRepositories();

    expect(() =>
      getMappedResponses({ form, recordStoreFactory: factory, cache, kv }, "form-1")
    ).toThrow(/No destination spreadsheet/);
  });

  it("returns an empty array when there is only a header row", () => {
    const form = new InMemoryFormRepository();
    form.setDestination("form-1", "sheet-1");
    const cache = new InMemoryCacheRepository();
    const kv = new InMemoryKeyValueRepository();
    const { factory } = createInMemoryRecordStoreRepositories();
    factory("sheet-1").replaceCollection("Sheet1", [["timestamp", "email"]]);

    const rows = getMappedResponses({ form, recordStoreFactory: factory, cache, kv }, "form-1");
    expect(rows).toEqual([]);
  });
});
