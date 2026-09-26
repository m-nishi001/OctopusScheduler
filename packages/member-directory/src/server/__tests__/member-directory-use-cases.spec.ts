import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  addMember,
  deleteMember,
  findMemberById,
  listMembers,
  replaceAllMembers,
  updateMember,
} from "../member-directory-use-cases";
import type { MemberDirectoryUseCaseDeps } from "../member-directory-use-cases";

function createDeps(): MemberDirectoryUseCaseDeps {
  let counter = 0;
  return {
    storage: new InMemoryKeyValueStorage(),
    generateId: () => `generated-${++counter}`,
  };
}

describe("member-directory-use-cases", () => {
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

  it("replaceAllMembers upserts by id without deleting existing members", async () => {
    const deps = createDeps();
    await addMember(deps, { id: "u1", name: "太郎" });
    const result = await replaceAllMembers(deps, [
      { id: "u1", name: "太郎(改)" },
      { id: "u2", name: "次郎" },
    ]);
    expect(result).toEqual({ replaced: 2 });
    expect(await listMembers(deps)).toEqual([
      { id: "u1", name: "太郎(改)" },
      { id: "u2", name: "次郎" },
    ]);
  });

  it("auto-generates ids for replaced members that omit one", async () => {
    const deps = createDeps();
    const result = await replaceAllMembers(deps, [{ id: "", name: "太郎" }]);
    expect(result).toEqual({ replaced: 1 });
    expect(await listMembers(deps)).toEqual([{ id: "generated-1", name: "太郎" }]);
  });
});
