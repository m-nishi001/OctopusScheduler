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
  it("returns an empty list when no members are registered", () => {
    expect(listMembers(createDeps())).toEqual([]);
  });

  it("adds a member with a caller-supplied id", () => {
    const deps = createDeps();
    const created = addMember(deps, { id: "u1", name: "太郎" });
    expect(created).toEqual({ id: "u1", name: "太郎" });
    expect(listMembers(deps)).toEqual([{ id: "u1", name: "太郎" }]);
  });

  it("auto-generates an id when none is supplied", () => {
    const deps = createDeps();
    const created = addMember(deps, { name: "太郎" });
    expect(created.id).toBe("generated-1");
    expect(created.name).toBe("太郎");
  });

  it("rejects adding a member with a duplicate id", () => {
    const deps = createDeps();
    addMember(deps, { id: "u1", name: "太郎" });
    expect(() => addMember(deps, { id: "u1", name: "次郎" })).toThrow();
  });

  it("rejects an empty name", () => {
    const deps = createDeps();
    expect(() => addMember(deps, { id: "u1", name: "  " })).toThrow();
  });

  it("updates an existing member's name", () => {
    const deps = createDeps();
    addMember(deps, { id: "u1", name: "太郎" });
    const updated = updateMember(deps, { id: "u1", name: "太郎(改)" });
    expect(updated).toEqual({ id: "u1", name: "太郎(改)" });
    expect(listMembers(deps)).toEqual([{ id: "u1", name: "太郎(改)" }]);
  });

  it("throws when updating a member that does not exist", () => {
    const deps = createDeps();
    expect(() => updateMember(deps, { id: "missing", name: "x" })).toThrow();
  });

  it("deletes a member", () => {
    const deps = createDeps();
    addMember(deps, { id: "u1", name: "太郎" });
    addMember(deps, { id: "u2", name: "次郎" });
    deleteMember(deps, "u1");
    expect(listMembers(deps)).toEqual([{ id: "u2", name: "次郎" }]);
  });

  it("does not throw when deleting a member that does not exist", () => {
    const deps = createDeps();
    expect(() => deleteMember(deps, "missing")).not.toThrow();
  });

  it("finds a member by id", () => {
    const deps = createDeps();
    addMember(deps, { id: "u1", name: "太郎" });
    expect(findMemberById(deps, "u1")).toEqual({ id: "u1", name: "太郎" });
    expect(findMemberById(deps, "missing")).toBeNull();
  });

  it("replaceAllMembers upserts by id without deleting existing members", () => {
    const deps = createDeps();
    addMember(deps, { id: "u1", name: "太郎" });
    const result = replaceAllMembers(deps, [
      { id: "u1", name: "太郎(改)" },
      { id: "u2", name: "次郎" },
    ]);
    expect(result).toEqual({ replaced: 2 });
    expect(listMembers(deps)).toEqual([
      { id: "u1", name: "太郎(改)" },
      { id: "u2", name: "次郎" },
    ]);
  });

  it("auto-generates ids for replaced members that omit one", () => {
    const deps = createDeps();
    const result = replaceAllMembers(deps, [{ id: "", name: "太郎" }]);
    expect(result).toEqual({ replaced: 1 });
    expect(listMembers(deps)).toEqual([{ id: "generated-1", name: "太郎" }]);
  });
});
