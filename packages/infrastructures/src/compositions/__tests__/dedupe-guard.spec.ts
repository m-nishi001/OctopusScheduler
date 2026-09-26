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
  it("allows the first save and blocks a duplicate once saved", async () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    const first = await beginSave(deps, "item-1");
    expect(first.proceed).toBe(true);
    await commitSave(deps, "item-1");

    const second = await beginSave(deps, "item-1");
    expect(second.proceed).toBe(false);
    if (!second.proceed) {
      expect(second.result.status).toBe("duplicate");
    }
  });

  it("rejects a save that is already in progress", async () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    await beginSave(deps, "item-1");
    const second = await beginSave(deps, "item-1");
    expect(second.proceed).toBe(false);
    if (!second.proceed) {
      expect(second.result.status).toBe("error");
    }
  });

  it("clears state on abortSave, allowing a retry", async () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    await beginSave(deps, "item-1");
    await abortSave(deps, "item-1");

    const retry = await beginSave(deps, "item-1");
    expect(retry.proceed).toBe(true);
  });

  it("requires an item to be saved before it can be updated", async () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    const notSaved = await beginUpdate(deps, "item-1");
    expect(notSaved.proceed).toBe(false);

    await beginSave(deps, "item-1");
    await commitSave(deps, "item-1");

    const ok = await beginUpdate(deps, "item-1");
    expect(ok.proceed).toBe(true);
    await commitUpdate(deps, "item-1");

    expect(await cache.get("item-1")).toBe("saved");
  });

  it("clears state on abortUpdate and via clearDedupeState", async () => {
    const cache = new InMemoryCache();
    const deps = { cache };

    await beginSave(deps, "item-1");
    await commitSave(deps, "item-1");
    await beginUpdate(deps, "item-1");
    await abortUpdate(deps, "item-1");
    expect(await cache.get("item-1")).toBeNull();

    await cache.put("item-1", "saved", 3600);
    await clearDedupeState(deps, "item-1");
    expect(await cache.get("item-1")).toBeNull();
  });
});
