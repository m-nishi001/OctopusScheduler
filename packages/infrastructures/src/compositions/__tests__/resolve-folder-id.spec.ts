import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "../../testing/in-memory-key-value-storage";
import {
  resolveFolderIdIgnoringProvided,
  resolveFolderIdPreferringProvided,
} from "../resolve-folder-id";

describe("resolveFolderIdIgnoringProvided", () => {
  it("always uses the configured property, ignoring the provided id", () => {
    const kv = new InMemoryKeyValueStorage();
    kv.set("asset-folder", "configured-folder");

    expect(
      resolveFolderIdIgnoringProvided({ kv }, "asset-folder")
    ).toBe("configured-folder");
  });

  it("throws when the property is not configured", () => {
    const kv = new InMemoryKeyValueStorage();
    expect(() => resolveFolderIdIgnoringProvided({ kv }, "asset-folder")).toThrow(
      /asset-folder/
    );
  });
});

describe("resolveFolderIdPreferringProvided", () => {
  it("prefers the provided id over the configured property", () => {
    const kv = new InMemoryKeyValueStorage();
    kv.set("asset-folder", "configured-folder");

    expect(
      resolveFolderIdPreferringProvided({ kv }, "asset-folder", "provided-folder")
    ).toBe("provided-folder");
  });

  it("falls back to the configured property when none is provided", () => {
    const kv = new InMemoryKeyValueStorage();
    kv.set("asset-folder", "configured-folder");

    expect(
      resolveFolderIdPreferringProvided({ kv }, "asset-folder")
    ).toBe("configured-folder");
  });

  it("throws when neither is available", () => {
    const kv = new InMemoryKeyValueStorage();
    expect(() =>
      resolveFolderIdPreferringProvided({ kv }, "asset-folder")
    ).toThrow(/asset-folder/);
  });
});
