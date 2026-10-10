import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSeedEntries, hashPassword, parseBucketName } from "./seed-local-admin.js";

/** CloudflarePasswordHasher と同じ手順(WebCrypto)でハッシュを計算する。 */
async function webCryptoHash(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100_000 },
    key,
    256
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

test("hashPassword は Workers 側の PBKDF2 実装と同じ値になる", async () => {
  assert.equal(hashPassword("password-1234", "salt-xyz"), await webCryptoHash("password-1234", "salt-xyz"));
});

test("buildSeedEntries: 名簿・資格情報・セッションを scalar 名前空間で返す", () => {
  const entries = Object.fromEntries(
    buildSeedEntries({ id: "admin", name: "A", password: "password-1234", token: "tok", now: 1000 })
  );
  assert.deepEqual(JSON.parse(entries["__scalars__/member-directory-members"]), [{ id: "admin", name: "A", isAdmin: true }]);
  const cred = JSON.parse(entries["__scalars__/accounts-credential/admin"]);
  assert.equal(cred.hash, hashPassword("password-1234", cred.salt));
  const session = JSON.parse(entries["__scalars__/accounts-session/tok"]);
  assert.equal(session.memberId, "admin");
  assert.equal(session.expiresAt, 1000 + 7 * 24 * 60 * 60 * 1000);
});

test("buildSeedEntries: 既存メンバーを保持し、同IDは置き換える", () => {
  const entries = Object.fromEntries(
    buildSeedEntries({
      id: "admin",
      name: "New",
      password: "password-1234",
      token: "t",
      now: 0,
      existingMembers: [{ id: "u1", name: "U1" }, { id: "admin", name: "Old" }],
    })
  );
  assert.deepEqual(JSON.parse(entries["__scalars__/member-directory-members"]), [
    { id: "u1", name: "U1" },
    { id: "admin", name: "New", isAdmin: true },
  ]);
});

test("buildSeedEntries: 短いパスワードや必須項目の欠落は拒否する", () => {
  assert.throws(() => buildSeedEntries({ id: "a", name: "A", password: "short", token: "t", now: 0 }));
  assert.throws(() => buildSeedEntries({ id: "", name: "A", password: "password-1234", token: "t", now: 0 }));
});

test("parseBucketName: r2_buckets の bucket_name を取り出す", () => {
  const toml = `[[d1_databases]]\nbinding = "DB"\n\n[[r2_buckets]]\nbinding = "BUCKET"\nbucket_name = "my-bucket"\n`;
  assert.equal(parseBucketName(toml), "my-bucket");
  assert.throws(() => parseBucketName("name = 'x'"));
});
