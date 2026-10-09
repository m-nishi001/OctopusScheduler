import { describe, it, expect } from "vitest";
import { CloudflarePasswordHasher } from "../cloudflare-password-hasher";

describe("CloudflarePasswordHasher", () => {
  const hasher = new CloudflarePasswordHasher();

  it("is deterministic for the same password and salt", async () => {
    expect(await hasher.hash("password-1", "salt")).toBe(await hasher.hash("password-1", "salt"));
  });

  it("differs when the password or salt differs", async () => {
    const base = await hasher.hash("password-1", "salt");
    expect(await hasher.hash("password-2", "salt")).not.toBe(base);
    expect(await hasher.hash("password-1", "other")).not.toBe(base);
  });

  it("returns a 64-char hex string and never the plain password", async () => {
    const hash = await hasher.hash("password-1", "salt");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("password-1");
  });
});
