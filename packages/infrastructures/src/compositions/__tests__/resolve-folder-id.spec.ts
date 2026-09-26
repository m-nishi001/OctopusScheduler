import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "../../testing/in-memory-key-value-storage";
import {
  resolveFolderIdIgnoringProvided,
  resolveFolderIdPreferringProvided,
} from "../resolve-folder-id";

describe("resolveFolderIdIgnoringProvided", () => {
  it("always uses the configured property, ignoring the provided id", async () => {
    const kv = new InMemoryKeyValueStorage();
    await kv.set("asset-folder", "configured-folder");

    expect(
      await resolveFolderIdIgnoringProvided({ kv }, "asset-folder")
    ).toBe("configured-folder");
  });

  it("throws when the property is not configured", async () => {
    const kv = new InMemoryKeyValueStorage();
    await expect(resolveFolderIdIgnoringProvided({ kv }, "asset-folder")).rejects.toThrow(
      /asset-folder/
    );
  });
});

describe("resolveFolderIdPreferringProvided", () => {
  it("prefers the provided id over the configured property", async () => {
    const kv = new InMemoryKeyValueStorage();
    await kv.set("asset-folder", "configured-folder");

    expect(
      await resolveFolderIdPreferringProvided({ kv }, "asset-folder", "provided-folder")
    ).toBe("provided-folder");
  });

  it("falls back to the configured property when none is provided", async () => {
    const kv = new InMemoryKeyValueStorage();
    await kv.set("asset-folder", "configured-folder");

    expect(
      await resolveFolderIdPreferringProvided({ kv }, "asset-folder")
    ).toBe("configured-folder");
  });

  it("throws when neither is available", async () => {
    const kv = new InMemoryKeyValueStorage();
    await expect(
      resolveFolderIdPreferringProvided({ kv }, "asset-folder")
    ).rejects.toThrow(/asset-folder/);
  });
});
