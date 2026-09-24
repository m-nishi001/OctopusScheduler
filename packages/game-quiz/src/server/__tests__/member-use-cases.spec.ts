import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  addMember,
  deleteMember,
  listMembers,
  updateMember,
} from "../member-use-cases";

describe("member-use-cases", () => {
  it("returns an empty list when no members are registered", () => {
    const storage = new InMemoryKeyValueStorage();
    expect(listMembers({ storage })).toEqual([]);
  });

  it("adds a member and lists it back", () => {
    const storage = new InMemoryKeyValueStorage();
    const created = addMember({ storage }, { userId: "u1", displayName: "太郎" });
    expect(created).toEqual({ userId: "u1", displayName: "太郎" });
    expect(listMembers({ storage })).toEqual([{ userId: "u1", displayName: "太郎" }]);
  });

  it("rejects adding a member with a duplicate userId", () => {
    const storage = new InMemoryKeyValueStorage();
    addMember({ storage }, { userId: "u1", displayName: "太郎" });
    expect(() => addMember({ storage }, { userId: "u1", displayName: "次郎" })).toThrow();
  });

  it("rejects an empty userId", () => {
    const storage = new InMemoryKeyValueStorage();
    expect(() => addMember({ storage }, { userId: "  ", displayName: "太郎" })).toThrow();
  });

  it("updates an existing member's displayName", () => {
    const storage = new InMemoryKeyValueStorage();
    addMember({ storage }, { userId: "u1", displayName: "太郎" });
    const updated = updateMember({ storage }, { userId: "u1", displayName: "太郎(改)" });
    expect(updated).toEqual({ userId: "u1", displayName: "太郎(改)" });
    expect(listMembers({ storage })).toEqual([{ userId: "u1", displayName: "太郎(改)" }]);
  });

  it("throws when updating a member that does not exist", () => {
    const storage = new InMemoryKeyValueStorage();
    expect(() =>
      updateMember({ storage }, { userId: "missing", displayName: "x" })
    ).toThrow();
  });

  it("deletes a member", () => {
    const storage = new InMemoryKeyValueStorage();
    addMember({ storage }, { userId: "u1", displayName: "太郎" });
    addMember({ storage }, { userId: "u2", displayName: "次郎" });
    deleteMember({ storage }, "u1");
    expect(listMembers({ storage })).toEqual([{ userId: "u2", displayName: "次郎" }]);
  });

  it("does not throw when deleting a member that does not exist", () => {
    const storage = new InMemoryKeyValueStorage();
    expect(() => deleteMember({ storage }, "missing")).not.toThrow();
  });
});
