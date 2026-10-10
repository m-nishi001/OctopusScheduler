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

  it("期限切れセッションのキーは、次のログイン時に実削除される", async () => {
    const deps = await setupAdmin();
    const first = await login(deps, { id: "admin", password: "correct-horse" });
    deps.advance(SESSION_TTL_MS + 1);
    const second = await login(deps, { id: "admin", password: "correct-horse" });
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

  it(`有効なセッションが${MAX_ACTIVE_SESSIONS}件を超えたら古い順に失効させる`, async () => {
    const deps = await setupAdmin();
    const tokens: string[] = [];
    for (let i = 0; i < MAX_ACTIVE_SESSIONS + 1; i++) {
      tokens.push((await login(deps, { id: "admin", password: "correct-horse" })).token);
      deps.advance(1);
    }
    expect(await getSession(deps, tokens[0])).toBeNull();
    expect(await getSession(deps, tokens[1])).not.toBeNull();
    expect(await getSession(deps, tokens[MAX_ACTIVE_SESSIONS])).not.toBeNull();
  });

  it("メンバー削除で認証情報も実削除される", async () => {
    const deps = await setupAdmin();
    await deleteMember(deps, "admin");
    expect(await deps.storage.get("accounts-credential/admin")).toBeNull();
  });
});
