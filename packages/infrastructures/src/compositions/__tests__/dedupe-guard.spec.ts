import { describe, it, expect } from "vitest";
import { InMemoryCache } from "../../testing/in-memory-cache";
import {
  beginSave,
  commitSave,
  abortSave,
  beginUpdate,
  commitUpdate,
  abortUpdate,
  clearDedupeState,
} from "../dedupe-guard";

describe("dedupe-guard", () => {
  it("allows the first save and blocks a duplicate once saved", () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    const first = beginSave(deps, "item-1");
    expect(first.proceed).toBe(true);
    commitSave(deps, "item-1");

    const second = beginSave(deps, "item-1");
    expect(second.proceed).toBe(false);
    if (!second.proceed) {
      expect(second.result.status).toBe("duplicate");
    }
  });

  it("rejects a save that is already in progress", () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    beginSave(deps, "item-1");
    const second = beginSave(deps, "item-1");
    expect(second.proceed).toBe(false);
    if (!second.proceed) {
      expect(second.result.status).toBe("error");
    }
  });

  it("clears state on abortSave, allowing a retry", () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    beginSave(deps, "item-1");
    abortSave(deps, "item-1");

    const retry = beginSave(deps, "item-1");
    expect(retry.proceed).toBe(true);
  });

  it("requires an item to be saved before it can be updated", () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    const notSaved = beginUpdate(deps, "item-1");
    expect(notSaved.proceed).toBe(false);

    beginSave(deps, "item-1");
    commitSave(deps, "item-1");

    const ok = beginUpdate(deps, "item-1");
    expect(ok.proceed).toBe(true);
    commitUpdate(deps, "item-1");

    expect(cache.get("item-1")).toBe("saved");
  });

  it("clears state on abortUpdate and via clearDedupeState", () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    beginSave(deps, "item-1");
    commitSave(deps, "item-1");
    beginUpdate(deps, "item-1");
    abortUpdate(deps, "item-1");
    expect(cache.get("item-1")).toBeNull();

    cache.put("item-1", "saved", 3600);
    clearDedupeState(deps, "item-1");
    expect(cache.get("item-1")).toBeNull();
  });
});
