import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { addMember } from "@octopus/member-directory/server-use-cases";
import { loginParticipant, resolveDeviceToken } from "../participant-auth-use-cases";

function stubTokenGenerator(tokens: string[]) {
  let i = 0;
  return () => tokens[i++] ?? `token-${i}`;
}

function stubGenerateId(): string {
  throw new Error("generateId should not be called in these tests");
}

describe("participant-auth-use-cases", () => {
  it("logs in a registered member and issues a device token", async () => {
    const storage = new InMemoryKeyValueStorage();
    await addMember({ storage, generateId: stubGenerateId }, { id: "u1", name: "太郎" });
    const generateToken = stubTokenGenerator(["tok-1"]);

    const session = await loginParticipant(
      { storage, generateId: stubGenerateId, generateToken },
      { userId: "u1" }
    );

    expect(session).toEqual({ token: "tok-1", userId: "u1", displayName: "太郎" });
  });

  it("rejects login for an unregistered userId", async () => {
    const storage = new InMemoryKeyValueStorage();
    const generateToken = stubTokenGenerator(["tok-1"]);

    await expect(
      loginParticipant(
        { storage, generateId: stubGenerateId, generateToken },
        { userId: "unknown" }
      )
    ).rejects.toThrow();
  });

  it("resolves a previously issued device token back to the participant", async () => {
    const storage = new InMemoryKeyValueStorage();
    await addMember({ storage, generateId: stubGenerateId }, { id: "u1", name: "太郎" });
    const generateToken = stubTokenGenerator(["tok-1"]);
    await loginParticipant(
      { storage, generateId: stubGenerateId, generateToken },
      { userId: "u1" }
    );

    const session = await resolveDeviceToken(
      { storage, generateId: stubGenerateId, generateToken },
      { token: "tok-1" }
    );

    expect(session).toEqual({ token: "tok-1", userId: "u1", displayName: "太郎" });
  });

  it("rejects an unknown or expired device token", async () => {
    const storage = new InMemoryKeyValueStorage();
    const generateToken = stubTokenGenerator([]);

    await expect(
      resolveDeviceToken(
        { storage, generateId: stubGenerateId, generateToken },
        { token: "does-not-exist" }
      )
    ).rejects.toThrow();
  });

  it("rejects a device token whose member was since deleted", async () => {
    const storage = new InMemoryKeyValueStorage();
    await addMember({ storage, generateId: stubGenerateId }, { id: "u1", name: "太郎" });
    const generateToken = stubTokenGenerator(["tok-1"]);
    await loginParticipant(
      { storage, generateId: stubGenerateId, generateToken },
      { userId: "u1" }
    );
    await storage.set("member-directory-members", JSON.stringify([]));

    await expect(
      resolveDeviceToken(
        { storage, generateId: stubGenerateId, generateToken },
        { token: "tok-1" }
      )
    ).rejects.toThrow();
  });

  it("issues distinct tokens for repeated logins of the same member", async () => {
    const storage = new InMemoryKeyValueStorage();
    await addMember({ storage, generateId: stubGenerateId }, { id: "u1", name: "太郎" });
    const generateToken = stubTokenGenerator(["tok-1", "tok-2"]);

    const first = await loginParticipant(
      { storage, generateId: stubGenerateId, generateToken },
      { userId: "u1" }
    );
    const second = await loginParticipant(
      { storage, generateId: stubGenerateId, generateToken },
      { userId: "u1" }
    );

    expect(first.token).not.toEqual(second.token);
    expect(
      (
        await resolveDeviceToken(
          { storage, generateId: stubGenerateId, generateToken },
          { token: first.token }
        )
      ).userId
    ).toBe("u1");
    expect(
      (
        await resolveDeviceToken(
          { storage, generateId: stubGenerateId, generateToken },
          { token: second.token }
        )
      ).userId
    ).toBe("u1");
  });
});
