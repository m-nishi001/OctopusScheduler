import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { addMember } from "../member-use-cases";
import { loginParticipant, resolveDeviceToken } from "../participant-auth-use-cases";

function stubTokenGenerator(tokens: string[]) {
  let i = 0;
  return () => tokens[i++] ?? `token-${i}`;
}

describe("participant-auth-use-cases", () => {
  it("logs in a registered member and issues a device token", () => {
    const storage = new InMemoryKeyValueStorage();
    addMember({ storage }, { userId: "u1", displayName: "太郎" });
    const generateToken = stubTokenGenerator(["tok-1"]);

    const session = loginParticipant({ storage, generateToken }, { userId: "u1" });

    expect(session).toEqual({ token: "tok-1", userId: "u1", displayName: "太郎" });
  });

  it("rejects login for an unregistered userId", () => {
    const storage = new InMemoryKeyValueStorage();
    const generateToken = stubTokenGenerator(["tok-1"]);

    expect(() =>
      loginParticipant({ storage, generateToken }, { userId: "unknown" })
    ).toThrow();
  });

  it("resolves a previously issued device token back to the participant", () => {
    const storage = new InMemoryKeyValueStorage();
    addMember({ storage }, { userId: "u1", displayName: "太郎" });
    const generateToken = stubTokenGenerator(["tok-1"]);
    loginParticipant({ storage, generateToken }, { userId: "u1" });

    const session = resolveDeviceToken({ storage, generateToken }, { token: "tok-1" });

    expect(session).toEqual({ token: "tok-1", userId: "u1", displayName: "太郎" });
  });

  it("rejects an unknown or expired device token", () => {
    const storage = new InMemoryKeyValueStorage();
    const generateToken = stubTokenGenerator([]);

    expect(() =>
      resolveDeviceToken({ storage, generateToken }, { token: "does-not-exist" })
    ).toThrow();
  });

  it("rejects a device token whose member was since deleted", () => {
    const storage = new InMemoryKeyValueStorage();
    addMember({ storage }, { userId: "u1", displayName: "太郎" });
    const generateToken = stubTokenGenerator(["tok-1"]);
    loginParticipant({ storage, generateToken }, { userId: "u1" });
    storage.set("quiz-game-members", JSON.stringify([]));

    expect(() =>
      resolveDeviceToken({ storage, generateToken }, { token: "tok-1" })
    ).toThrow();
  });

  it("issues distinct tokens for repeated logins of the same member", () => {
    const storage = new InMemoryKeyValueStorage();
    addMember({ storage }, { userId: "u1", displayName: "太郎" });
    const generateToken = stubTokenGenerator(["tok-1", "tok-2"]);

    const first = loginParticipant({ storage, generateToken }, { userId: "u1" });
    const second = loginParticipant({ storage, generateToken }, { userId: "u1" });

    expect(first.token).not.toEqual(second.token);
    expect(resolveDeviceToken({ storage, generateToken }, { token: first.token }).userId).toBe(
      "u1"
    );
    expect(resolveDeviceToken({ storage, generateToken }, { token: second.token }).userId).toBe(
      "u1"
    );
  });
});
