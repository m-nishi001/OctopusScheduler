import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword } from "./seed-local-admin.js";
import { buildTestDataEntries, buildTestMembers, deriveLoginKey, deterministicSalt, mergeMembers, parseArgs } from "./seed-test-data.js";

const ADMIN = { id: "admin", name: "A", password: "password-1234" };
const base = { admin: ADMIN, participantPassword: "participant-1234", token: "tok", now: 1000 };

test("buildTestMembers: 架空IDを連番で作り、桁は人数に合わせる", () => {
  const members = buildTestMembers(3);
  assert.deepEqual(members.map((m) => m.id), ["test-user-01", "test-user-02", "test-user-03"]);
  assert.equal(buildTestMembers(100).at(-1).id, "test-user-100");
});

test("buildTestMembers: 範囲外の人数は拒否する", () => {
  assert.throws(() => buildTestMembers(0));
  assert.throws(() => buildTestMembers(201));
  assert.throws(() => buildTestMembers(1.5));
});

test("buildTestDataEntries: 名簿に管理者と参加者が入り、参加者は管理者フラグを持たない", () => {
  const entries = Object.fromEntries(buildTestDataEntries({ ...base, count: 3 }));
  const members = JSON.parse(entries["__scalars__/member-directory-members"]);
  assert.equal(members.length, 4);
  assert.deepEqual(members.find((m) => m.id === "admin"), { id: "admin", name: "A", isAdmin: true });
  assert.ok(members.filter((m) => m.id.startsWith("test-user-")).every((m) => m.isAdmin === undefined));
});

test("buildTestDataEntries: 参加者の資格情報が検証できる形で入る", () => {
  const entries = Object.fromEntries(buildTestDataEntries({ ...base, count: 2 }));
  const cred = JSON.parse(entries["__scalars__/accounts-credential/test-user-02"]);
  assert.equal(cred.hash, hashPassword("participant-1234", cred.salt));
  assert.ok(entries["__scalars__/accounts-session/tok"]);
});

test("buildTestDataEntries: 参加者の資格情報は決定的で冪等", () => {
  const pick = () =>
    Object.fromEntries(buildTestDataEntries({ ...base, count: 2 }))["__scalars__/accounts-credential/test-user-01"];
  assert.equal(pick(), pick());
  assert.equal(deterministicSalt("x"), deterministicSalt("x"));
  assert.notEqual(deterministicSalt("x"), deterministicSalt("y"));
});

test("buildTestDataEntries: 既存の他メンバーは残し、再実行で名簿が増えない", () => {
  const existing = [{ id: "real-user", name: "R" }];
  const first = JSON.parse(Object.fromEntries(buildTestDataEntries({ ...base, count: 2, existingMembers: existing }))["__scalars__/member-directory-members"]);
  const second = JSON.parse(Object.fromEntries(buildTestDataEntries({ ...base, count: 2, existingMembers: first }))["__scalars__/member-directory-members"]);
  assert.ok(second.some((m) => m.id === "real-user"));
  assert.equal(second.length, first.length);
});

test("buildTestDataEntries: 短い参加者パスワードは拒否する", () => {
  assert.throws(() => buildTestDataEntries({ ...base, participantPassword: "short" }));
});

test("mergeMembers: 同じIDはテスト側で置き換える", () => {
  assert.deepEqual(mergeMembers([{ id: "a", name: "old" }, { id: "b", name: "B" }], [{ id: "a", name: "new" }]), [
    { id: "b", name: "B" },
    { id: "a", name: "new" },
  ]);
});

test("parseArgs: --remote は値を取らないフラグ", () => {
  assert.deepEqual(parseArgs(["--config", "w.toml", "--remote", "--count", "5"]), { remote: true, config: "w.toml", count: "5" });
  assert.deepEqual(parseArgs(["--config", "w.toml"]), { remote: false, config: "w.toml" });
});

test("buildTestDataEntries: 参加者ごとに受付QR用のログインキーが検証できる形で入り、管理者には入らない", () => {
  const entries = Object.fromEntries(buildTestDataEntries({ ...base, count: 2 }));
  const stored = JSON.parse(entries["__scalars__/accounts-login-key/test-user-01"]);
  assert.equal(stored.hash, hashPassword(deriveLoginKey("test-user-01"), stored.salt));
  assert.equal(entries["__scalars__/accounts-login-key/admin"], undefined);
});

test("buildTestDataEntries: 渡したログインキーを優先する(リモートはランダム値)", () => {
  const entries = Object.fromEntries(buildTestDataEntries({ ...base, count: 1, loginKeys: { "test-user-01": "random-key-value" } }));
  const stored = JSON.parse(entries["__scalars__/accounts-login-key/test-user-01"]);
  assert.equal(stored.hash, hashPassword("random-key-value", stored.salt));
});

test("deriveLoginKey: 決定的で、IDごとに異なる64桁のhex", () => {
  assert.equal(deriveLoginKey("a"), deriveLoginKey("a"));
  assert.notEqual(deriveLoginKey("a"), deriveLoginKey("b"));
  assert.match(deriveLoginKey("a"), /^[0-9a-f]{64}$/);
});
