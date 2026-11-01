import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  addMember,
  deleteMember,
  findMemberById,
  listMembers,
  applyRoster,
  updateMember,
} from "../accounts-use-cases";
import type { AccountsUseCaseDeps } from "../accounts-use-cases";

function createDeps(): AccountsUseCaseDeps {
  let counter = 0;
  return {
    storage: new InMemoryKeyValueStorage(),
    generateId: () => `generated-${++counter}`,
  };
}

/** 同じキーの排他を直列実行で表現する(本番は D1 / LockService)。 */
function serialLock(): NonNullable<AccountsUseCaseDeps["lock"]> {
  const chains = new Map<string, Promise<unknown>>();
  return {
    withLock: <T>(key: string, _timeoutMs: number, fn: () => Promise<T> | T) => {
      const run = (chains.get(key) ?? Promise.resolve()).then(fn);
      chains.set(key, run.catch(() => undefined));
      return run;
    },
  };
}

describe("accounts-use-cases", () => {
  it("returns an empty list when no members are registered", async () => {
    expect(await listMembers(createDeps())).toEqual([]);
  });

  it("adds a member with a caller-supplied id", async () => {
    const deps = createDeps();
    const created = await addMember(deps, { id: "u1", name: "太郎" });
    expect(created).toEqual({ id: "u1", name: "太郎" });
    expect(await listMembers(deps)).toEqual([{ id: "u1", name: "太郎" }]);
  });

  it("auto-generates an id when none is supplied", async () => {
    const deps = createDeps();
    const created = await addMember(deps, { name: "太郎" });
    expect(created.id).toBe("generated-1");
    expect(created.name).toBe("太郎");
  });

  it("rejects adding a member with a duplicate id", async () => {
    const deps = createDeps();
    await addMember(deps, { id: "u1", name: "太郎" });
    await expect(addMember(deps, { id: "u1", name: "次郎" })).rejects.toThrow();
  });

  it("rejects an empty name", async () => {
    const deps = createDeps();
    await expect(addMember(deps, { id: "u1", name: "  " })).rejects.toThrow();
  });

  it("updates an existing member's name", async () => {
    const deps = createDeps();
    await addMember(deps, { id: "u1", name: "太郎" });
    const updated = await updateMember(deps, { id: "u1", name: "太郎(改)" });
    expect(updated).toEqual({ id: "u1", name: "太郎(改)" });
    expect(await listMembers(deps)).toEqual([{ id: "u1", name: "太郎(改)" }]);
  });

  it("throws when updating a member that does not exist", async () => {
    const deps = createDeps();
    await expect(updateMember(deps, { id: "missing", name: "x" })).rejects.toThrow();
  });

  it("deletes a member", async () => {
    const deps = createDeps();
    await addMember(deps, { id: "u1", name: "太郎" });
    await addMember(deps, { id: "u2", name: "次郎" });
    await deleteMember(deps, "u1");
    expect(await listMembers(deps)).toEqual([{ id: "u2", name: "次郎" }]);
  });

  it("does not throw when deleting a member that does not exist", async () => {
    const deps = createDeps();
    await expect(deleteMember(deps, "missing")).resolves.not.toThrow();
  });

  it("finds a member by id", async () => {
    const deps = createDeps();
    await addMember(deps, { id: "u1", name: "太郎" });
    expect(await findMemberById(deps, "u1")).toEqual({ id: "u1", name: "太郎" });
    expect(await findMemberById(deps, "missing")).toBeNull();
  });

  it("applyRoster upserts by id without deleting existing members", async () => {
    const deps = createDeps();
    await addMember(deps, { id: "u1", name: "太郎" });
    await addMember(deps, { id: "u3", name: "三郎" });
    const result = await applyRoster(deps, {
      upserts: [
        { id: "u1", name: "太郎(改)" },
        { id: "u2", name: "次郎" },
      ],
      deleteIds: [],
    });
    expect(result).toEqual({ upserted: 2, deleted: 0 });
    expect(await listMembers(deps)).toEqual([
      { id: "u1", name: "太郎(改)" },
      { id: "u3", name: "三郎" },
      { id: "u2", name: "次郎" },
    ]);
  });

  it("auto-generates ids for replaced members that omit one", async () => {
    const deps = createDeps();
    const result = await applyRoster(deps, { upserts: [{ id: "", name: "太郎" }], deleteIds: [] });
    expect(result).toEqual({ upserted: 1, deleted: 0 });
    expect(await listMembers(deps)).toEqual([{ id: "generated-1", name: "太郎" }]);
  });

  describe("同時に名簿を更新したとき", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `u${i + 1}`);

    it("排他しないと、同時の追加で片方の更新が失われる(排他が必要な理由)", async () => {
      const deps = createDeps();
      await Promise.all(ids.map((id) => addMember(deps, { id, name: id })));
      expect((await listMembers(deps)).length).toBeLessThan(ids.length);
    });

    it("排他すれば、同時に追加した全員が名簿に残る", async () => {
      const deps = { ...createDeps(), lock: serialLock() };
      await Promise.all(ids.map((id) => addMember(deps, { id, name: id })));
      expect((await listMembers(deps)).map((m) => m.id).sort()).toEqual([...ids].sort());
    });

    it("排他すれば、同時の削除・更新・一括反映も互いの更新を消さない", async () => {
      const deps = { ...createDeps(), lock: serialLock() };
      await Promise.all(ids.map((id) => addMember(deps, { id, name: id })));
      await Promise.all([
        ...ids.slice(0, 10).map((id) => deleteMember(deps, id)),
        ...ids.slice(10, 15).map((id) => updateMember(deps, { id, name: `${id}(改)` })),
        applyRoster(deps, { upserts: [{ id: "extra", name: "追加" }], deleteIds: [] }),
      ]);
      const members = await listMembers(deps);
      expect(members.map((m) => m.id).sort()).toEqual([...ids.slice(10), "extra"].sort());
      expect(members.filter((m) => m.name.endsWith("(改)")).map((m) => m.id).sort()).toEqual(ids.slice(10, 15).sort());
    });

    it("同時に同じIDを追加しても、1件だけ作られ、もう片方は重複として失敗する", async () => {
      const deps = { ...createDeps(), lock: serialLock() };
      const results = await Promise.allSettled([addMember(deps, { id: "same", name: "A" }), addMember(deps, { id: "same", name: "B" })]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await listMembers(deps)).toHaveLength(1);
    });
  });
});
