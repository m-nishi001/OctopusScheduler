import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { addJsonBlob } from "../add-json-blob-use-case";
import { getJsonBlob } from "../get-json-blob-use-case";

describe("addJsonBlob / getJsonBlob", () => {
  it("まだ何も保存していなければ json は null", async () => {
    const storage = new InMemoryKeyValueStorage();
    expect(await getJsonBlob({ storage }, "screens.json")).toEqual({ json: null });
  });

  it("保存したテキストを、中身を見ずにそのまま返す(配列でなくても、空の一覧でも書き換えない)", async () => {
    const storage = new InMemoryKeyValueStorage();
    const records = [
      JSON.stringify({ updatedAt: 1234, data: [{ screenName: "home" }] }),
      JSON.stringify({ updatedAt: 99, data: [] }),
      "not json at all",
    ];
    for (const json of records) {
      await addJsonBlob({ storage }, { fileName: "screens.json", json });
      expect(await getJsonBlob({ storage }, "screens.json")).toEqual({ json });
    }
  });

  it("ファイル名ごとに別々に保存する", async () => {
    const storage = new InMemoryKeyValueStorage();
    await addJsonBlob({ storage }, { fileName: "prizes.json", json: "A" });
    await addJsonBlob({ storage }, { fileName: "screens.json", json: "B" });
    expect((await getJsonBlob({ storage }, "prizes.json")).json).toBe("A");
    expect((await getJsonBlob({ storage }, "screens.json")).json).toBe("B");
  });
});
