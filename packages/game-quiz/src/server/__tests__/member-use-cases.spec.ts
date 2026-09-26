import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  addMember,
  deleteMember,
  listMembers,
  updateMember,
} from "../member-use-cases";

describe("member-use-cases", () => {
  it("returns an empty list when no members are registered", async () => {
    const storage = new InMemoryKeyValueStorage();
    expect(await listMembers({ storage })).toEqual([]);
  });

  it("adds a member and lists it back", async () => {
    const storage = new InMemoryKeyValueStorage();
    const created = await addMember({ storage }, { userId: "u1", displayName: "太郎" });
    expect(created).toEqual({ userId: "u1", displayName: "太郎" });
    expect(await listMembers({ storage })).toEqual([{ userId: "u1", displayName: "太郎" }]);
  });

  it("rejects adding a member with a duplicate userId", async () => {
    const storage = new InMemoryKeyValueStorage();
    await addMember({ storage }, { userId: "u1", displayName: "太郎" });
    await expect(addMember({ storage }, { userId: "u1", displayName: "次郎" })).rejects.toThrow();
  });

  it("rejects an empty userId", async () => {
    const storage = new InMemoryKeyValueStorage();
    await expect(addMember({ storage }, { userId: "  ", displayName: "太郎" })).rejects.toThrow();
  });

  it("updates an existing member's displayName", async () => {
    const storage = new InMemoryKeyValueStorage();
    await addMember({ storage }, { userId: "u1", displayName: "太郎" });
    const updated = await updateMember({ storage }, { userId: "u1", displayName: "太郎(改)" });
    expect(updated).toEqual({ userId: "u1", displayName: "太郎(改)" });
    expect(await listMembers({ storage })).toEqual([{ userId: "u1", displayName: "太郎(改)" }]);
  });

  it("throws when updating a member that does not exist", async () => {
    const storage = new InMemoryKeyValueStorage();
    await expect(
      updateMember({ storage }, { userId: "missing", displayName: "x" })
    ).rejects.toThrow();
  });

  it("deletes a member", async () => {
    const storage = new InMemoryKeyValueStorage();
    await addMember({ storage }, { userId: "u1", displayName: "太郎" });
    await addMember({ storage }, { userId: "u2", displayName: "次郎" });
    await deleteMember({ storage }, "u1");
    expect(await listMembers({ storage })).toEqual([{ userId: "u2", displayName: "次郎" }]);
  });

  it("does not throw when deleting a member that does not exist", async () => {
    const storage = new InMemoryKeyValueStorage();
    await expect(deleteMember({ storage }, "missing")).resolves.not.toThrow();
  });
});
