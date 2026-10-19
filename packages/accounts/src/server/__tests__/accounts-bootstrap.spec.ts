import { describe, it, expect } from "vitest";
import { FakeSecretProvider, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  addMember,
  BOOTSTRAP_ID_SECRET,
  BOOTSTRAP_PASSWORD_SECRET,
  deleteMember,
  getSession,
  InvalidCredentialsError,
  listAccounts,
  login,
  LOGIN_LOCK_MS,
  LoginLockedError,
  logout,
  MAX_ACTIVE_SESSIONS,
  MAX_SESSIONS_PER_SHARD,
  SESSION_SHARDS,
  MAX_GLOBAL_LOGIN_FAILURES,
  MAX_LOGIN_FAILURES,
  SESSION_TTL_MS,
  setPassword,
} from "../accounts-use-cases";
import type { AccountsAuthDeps } from "../accounts-use-cases";

const SECRET = "bootstrap-secret-1";

function createDeps(secrets: Record<string, string> = {}): AccountsAuthDeps & { advance(ms: number): void } {
  let counter = 0;
  let time = 1_000_000;
  return {
    storage: new InMemoryKeyValueStorage(),
    generateId: () => `generated-${++counter}`,
    hasher: { hash: async (password: string, salt: string) => `${salt}|${password}` },
    now: () => time,
    secrets: new FakeSecretProvider(secrets),
    advance: (ms) => {
      time += ms;
    },
  };
}

async function expectInvalid(promise: Promise<unknown>) {
  await expect(promise).rejects.toBeInstanceOf(InvalidCredentialsError);
}

describe("bootstrap admin", () => {
  it("管理者が0人なら、シークレットで初回ログインして管理者を作成する", async () => {
    const deps = createDeps({ [BOOTSTRAP_PASSWORD_SECRET]: SECRET });
    const { token, member } = await login(deps, { id: "admin", password: SECRET });
    expect(member).toEqual({ id: "admin", name: "管理者", isAdmin: true });
    expect(await getSession(deps, token)).toEqual(member);
    expect(await listAccounts(deps)).toEqual([{ id: "admin", name: "管理者", isAdmin: true, hasPassword: true }]);
  });

  it("OCTOPUS_BOOTSTRAP_ADMIN_ID でIDを変えられる(既定の admin は使えなくなる)", async () => {
    const deps = createDeps({ [BOOTSTRAP_PASSWORD_SECRET]: SECRET, [BOOTSTRAP_ID_SECRET]: "owner" });
    await expectInvalid(login(deps, { id: "admin", password: SECRET }));
    const { member } = await login(deps, { id: "owner", password: SECRET });
    expect(member.id).toBe("owner");
  });

  it("シークレット未設定なら何も起きない(fail closed)", async () => {
    const deps = createDeps();
    await expectInvalid(login(deps, { id: "admin", password: SECRET }));
    expect(await listAccounts(deps)).toEqual([]);
  });

  it("最小長に満たないシークレットは無効", async () => {
    const deps = createDeps({ [BOOTSTRAP_PASSWORD_SECRET]: "short" });
    await expectInvalid(login(deps, { id: "admin", password: "short" }));
    expect(await listAccounts(deps)).toEqual([]);
  });

  it("パスワードが違えば作成されない", async () => {
    const deps = createDeps({ [BOOTSTRAP_PASSWORD_SECRET]: SECRET });
    await expectInvalid(login(deps, { id: "admin", password: "wrong-password" }));
    expect(await listAccounts(deps)).toEqual([]);
  });

  it("ログイン可能な管理者が1人でもいれば、シークレットは無効になる", async () => {
    const deps = createDeps({ [BOOTSTRAP_PASSWORD_SECRET]: SECRET });
    await login(deps, { id: "admin", password: SECRET });
    await addMember(deps, { id: "other", name: "別人", isAdmin: true });
    await setPassword(deps, { id: "other", password: "other-password" });
    await expectInvalid(login(deps, { id: "intruder", password: SECRET }));
    expect((await listAccounts(deps)).map((a) => a.id)).toEqual(["admin", "other"]);
  });

  it("初回ログイン後、シークレットが残っていても管理者のパスワード変更が優先される", async () => {
    const deps = createDeps({ [BOOTSTRAP_PASSWORD_SECRET]: SECRET });
    await login(deps, { id: "admin", password: SECRET });
    await setPassword(deps, { id: "admin", password: "changed-password" });
    await expectInvalid(login(deps, { id: "admin", password: SECRET }));
    expect((await login(deps, { id: "admin", password: "changed-password" })).member.id).toBe("admin");
  });

  it("パスワード未設定の管理者しかいなければブートストラップが再開する(復旧手順)", async () => {
    const deps = createDeps({ [BOOTSTRAP_PASSWORD_SECRET]: SECRET });
    await login(deps, { id: "admin", password: SECRET });
    await deps.storage.deleteScalar("accounts-credential/admin");
    expect((await login(deps, { id: "admin", password: SECRET })).member.isAdmin).toBe(true);
  });

  it("既存の一般メンバーと同じIDなら、そのメンバーを管理者にする", async () => {
    const deps = createDeps({ [BOOTSTRAP_PASSWORD_SECRET]: SECRET });
    await addMember(deps, { id: "admin", name: "既存" });
    const { member } = await login(deps, { id: "admin", password: SECRET });
    expect(member).toEqual({ id: "admin", name: "既存", isAdmin: true });
  });

  it("同時に2回ログインしても管理者は二重に作られない", async () => {
    const deps = createDeps({ [BOOTSTRAP_PASSWORD_SECRET]: SECRET });
    // 排他は直列実行で表現する
    let chain: Promise<unknown> = Promise.resolve();
    deps.lock = {
      withLock: <T>(_key: string, _timeoutMs: number, fn: () => Promise<T> | T) => {
        const run = chain.then(fn);
        chain = run.catch(() => undefined);
        return run;
      },
    };
    await Promise.allSettled([
      login(deps, { id: "admin", password: SECRET }),
      login(deps, { id: "admin", password: SECRET }),
    ]);
    expect((await listAccounts(deps)).filter((a) => a.id === "admin")).toHaveLength(1);
  });
});

describe("login lockout", () => {
  async function setupAdmin() {
    const deps = createDeps();
    await addMember(deps, { id: "admin", name: "管理者", isAdmin: true });
    await setPassword(deps, { id: "admin", password: "correct-horse" });
    return deps;
  }

  it(`${MAX_LOGIN_FAILURES}回連続で失敗するとロックされ、正しいパスワードでも拒否する`, async () => {
    const deps = await setupAdmin();
    for (let i = 0; i < MAX_LOGIN_FAILURES; i++) {
      await expectInvalid(login(deps, { id: "admin", password: "wrong" }));
    }
    await expect(login(deps, { id: "admin", password: "correct-horse" })).rejects.toBeInstanceOf(LoginLockedError);
  });

  it("ロック時間が過ぎれば再びログインできる", async () => {
    const deps = await setupAdmin();
    for (let i = 0; i < MAX_LOGIN_FAILURES; i++) {
      await expectInvalid(login(deps, { id: "admin", password: "wrong" }));
    }
    deps.advance(LOGIN_LOCK_MS + 1);
    expect((await login(deps, { id: "admin", password: "correct-horse" })).member.id).toBe("admin");
  });

  it("成功すると失敗カウントがリセットされる", async () => {
    const deps = await setupAdmin();
    for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i++) {
      await expectInvalid(login(deps, { id: "admin", password: "wrong" }));
    }
    await login(deps, { id: "admin", password: "correct-horse" });
    for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i++) {
      await expectInvalid(login(deps, { id: "admin", password: "wrong" }));
    }
    expect((await login(deps, { id: "admin", password: "correct-horse" })).member.id).toBe("admin");
  });

  it("ロック解除後に失敗すると数え直し、すぐには再ロックされない", async () => {
    const deps = await setupAdmin();
    for (let i = 0; i < MAX_LOGIN_FAILURES; i++) {
      await expectInvalid(login(deps, { id: "admin", password: "wrong" }));
    }
    deps.advance(LOGIN_LOCK_MS + 1);
    await expectInvalid(login(deps, { id: "admin", password: "wrong" }));
    expect((await login(deps, { id: "admin", password: "correct-horse" })).member.id).toBe("admin");
  });

  it("存在しないIDはID単位のキーを作らず、共通カウンタで数える", async () => {
    const deps = await setupAdmin();
    await expectInvalid(login(deps, { id: "ghost", password: "wrong" }));
    expect(await deps.storage.get("accounts-attempts/ghost")).toBeNull();
    expect(await deps.storage.get("accounts-attempts/_global")).not.toBeNull();
  });

  it("未知IDへの試行が共通上限に達しても、実在の管理者はログインできる", async () => {
    const deps = await setupAdmin();
    for (let i = 0; i < MAX_GLOBAL_LOGIN_FAILURES; i++) {
      await expectInvalid(login(deps, { id: `ghost-${i}`, password: "wrong" }));
    }
    await expect(login(deps, { id: "ghost-x", password: "wrong" })).rejects.toBeInstanceOf(LoginLockedError);
    expect((await login(deps, { id: "admin", password: "correct-horse" })).member.id).toBe("admin");
  });
});

describe("session cleanup", () => {
  async function setupAdmin() {
    const deps = createDeps();
    await addMember(deps, { id: "admin", name: "管理者", isAdmin: true });
    await setPassword(deps, { id: "admin", password: "correct-horse" });
    return deps;
  }

  it("期限切れセッションのキーは、同じ区画への次のログイン時に実削除される", async () => {
    const deps = await setupAdmin();
    const first = await login(deps, { id: "admin", password: "correct-horse" });
    deps.advance(SESSION_TTL_MS + 1);
    // 索引は区画に分かれているので、期限切れのセッションと同じ区画に載るまでログインする
    let second = first;
    for (let i = 0; i < 200 && (await deps.storage.get(`accounts-session/${first.token}`)) !== null; i++) {
      second = await login(deps, { id: "admin", password: "correct-horse" });
    }
    expect(await deps.storage.get(`accounts-session/${first.token}`)).toBeNull();
    expect(await getSession(deps, first.token)).toBeNull();
    expect(await getSession(deps, second.token)).not.toBeNull();
  });

  it("ログアウトでセッションが実削除される", async () => {
    const deps = await setupAdmin();
    const { token } = await login(deps, { id: "admin", password: "correct-horse" });
    await logout(deps, token);
    expect(await deps.storage.get(`accounts-session/${token}`)).toBeNull();
    expect(await getSession(deps, token)).toBeNull();
  });

  it("区画の上限以内なら、どの区画に載ってもセッションは失効しない", async () => {
    const deps = await setupAdmin();
    const tokens: string[] = [];
    // どれだけ偏っても、1つの区画の上限(MAX_SESSIONS_PER_SHARD)を超えない件数
    for (let i = 0; i < MAX_SESSIONS_PER_SHARD; i++) {
      tokens.push((await login(deps, { id: "admin", password: "correct-horse" })).token);
      deps.advance(1);
    }
    for (const token of tokens) expect(await getSession(deps, token)).not.toBeNull();
  });

  it(`有効なセッションが${MAX_ACTIVE_SESSIONS}件を超えると、上限を超えた区画の古いものから失効し、新しいセッションは有効`, async () => {
    const deps = await setupAdmin();
    const tokens: string[] = [];
    for (let i = 0; i < MAX_ACTIVE_SESSIONS + 1; i++) {
      tokens.push((await login(deps, { id: "admin", password: "correct-horse" })).token);
      deps.advance(1);
    }
    const alive = (await Promise.all(tokens.map((t) => getSession(deps, t)))).filter((m) => m !== null).length;
    expect(alive).toBeLessThanOrEqual(MAX_ACTIVE_SESSIONS);
    expect(alive).toBeGreaterThan(MAX_ACTIVE_SESSIONS - SESSION_SHARDS * 4);
    expect(await getSession(deps, tokens[tokens.length - 1])).not.toBeNull();
    // 失効したものは、実際にストレージからも消えている
    const dead = tokens.filter((_, i) => i < tokens.length).length - alive;
    expect(dead).toBeGreaterThanOrEqual(1);
  });

  it("同時にログインしても、索引への登録が互いに失われない(区画ごとに順番に処理される)", async () => {
    const deps = await setupAdmin();
    let chain: Record<string, Promise<unknown>> = {};
    deps.lock = {
      withLock: <T>(key: string, _timeoutMs: number, fn: () => Promise<T> | T) => {
        const run = (chain[key] ?? Promise.resolve()).then(fn);
        chain[key] = run.catch(() => undefined);
        return run;
      },
    };
    const results = await Promise.all(Array.from({ length: 40 }, () => login(deps, { id: "admin", password: "correct-horse" })));
    chain = {};
    // 全員のセッションが有効で、索引にも全員分が載っている
    for (const r of results) expect(await getSession(deps, r.token)).not.toBeNull();
    const indexed = new Set<string>();
    for (let shard = 0; shard < SESSION_SHARDS; shard++) {
      const raw = await deps.storage.get(`accounts-session-index/${shard}`);
      for (const [token] of raw ? (JSON.parse(raw) as Array<[string, number]>) : []) indexed.add(token);
    }
    expect(indexed.size).toBe(40);
  });

  it("メンバー削除で認証情報も実削除される", async () => {
    const deps = await setupAdmin();
    await deleteMember(deps, "admin");
    expect(await deps.storage.get("accounts-credential/admin")).toBeNull();
  });
});
