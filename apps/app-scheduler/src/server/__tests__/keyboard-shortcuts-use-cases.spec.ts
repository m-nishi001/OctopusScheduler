import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  getKeyboardShortcuts,
  setKeyboardShortcuts,
} from "../keyboard-shortcuts-use-cases";

describe("keyboard-shortcuts-use-cases", () => {
  it("returns empty defaults with a null updatedAt when nothing has ever been saved", async () => {
    const kv = new InMemoryKeyValueStorage();
    const result = await getKeyboardShortcuts({ kv });
    expect(result).toEqual({
      shortcuts: [],
      config: { enabled: true },
      updatedAt: null,
    });
  });

  it("round-trips shortcuts/config/updatedAt through set then get", async () => {
    const kv = new InMemoryKeyValueStorage();
    const payload = {
      shortcuts: [{ id: "s1", keys: ["Control", "1"], eventIds: ["e1"] }],
      config: { enabled: false },
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await setKeyboardShortcuts({ kv }, payload);
    const result = await getKeyboardShortcuts({ kv });

    expect(result).toEqual(payload);
  });

  it("falls back to the legacy two-key format when the combined state was never written", async () => {
    const kv = new InMemoryKeyValueStorage();
    await kv.set(
      "keyboard-shortcuts",
      JSON.stringify([{ id: "legacy", keys: ["1"], eventIds: [] }])
    );
    await kv.set("keyboard-shortcuts-config", JSON.stringify({ enabled: false }));

    const result = await getKeyboardShortcuts({ kv });

    expect(result).toEqual({
      shortcuts: [{ id: "legacy", keys: ["1"], eventIds: [] }],
      config: { enabled: false },
      updatedAt: null,
    });
  });
});
