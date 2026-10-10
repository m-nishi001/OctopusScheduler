import type { IKeyValueStorage, ILock, IPasswordHasher, ISecretProvider } from "@octopus/infrastructures/interfaces";
import type { LoginResult, Member } from "./accounts-api-contract";

export interface AccountsUseCaseDeps {
  storage: IKeyValueStorage;
  /** id省略時の採番。GAS本番では Utilities.getUuid() を注入する。 */
  generateId: () => string;
}

const MEMBERS_KEY = "member-directory-members";
const CREDENTIAL_KEY_PREFIX = "accounts-credential/";
const SESSION_KEY_PREFIX = "accounts-session/";
/** セッションの有効期間(固定)。 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;

/** 初回管理者のブートストラップ用パスワード(GAS: ScriptProperty / Cloudflare: Worker Secret)。 */
export const BOOTSTRAP_PASSWORD_SECRET = "OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD";
/** ブートストラップ管理者のID(任意)。 */
export const BOOTSTRAP_ID_SECRET = "OCTOPUS_BOOTSTRAP_ADMIN_ID";
const DEFAULT_BOOTSTRAP_ID = "admin";
const BOOTSTRAP_ADMIN_NAME = "管理者";

const ATTEMPT_KEY_PREFIX = "accounts-attempts/";
/** 存在しないIDへの試行をまとめて数える共通カウンタ(ID単位のキーを無限に増やさないため)。 */
const GLOBAL_ATTEMPT_KEY = ATTEMPT_KEY_PREFIX + "_global";
/** ID単位の連続失敗の上限と、到達後のロック時間。 */
export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
/** 未知IDの共通カウンタの上限(正規の管理者の入力ミスでは到達しない大きさ)。 */
export const MAX_GLOBAL_LOGIN_FAILURES = 100;

const SESSION_INDEX_KEY = "accounts-session-index";
/** 索引は GAS の ScriptProperty(1値あたり約9KB)に収まる件数に抑える。超えたら古い順に失効させる。 */
export const MAX_ACTIVE_SESSIONS = 100;
const AUTH_LOCK_KEY = "accounts-auth";
const AUTH_LOCK_TIMEOUT_MS = 10_000;

/** 認証系ユースケースが追加で必要とする依存。 */
export interface AccountsAuthDeps extends AccountsUseCaseDeps {
  hasher: IPasswordHasher;
  /** 現在時刻(ms)。テストで差し替える。 */
  now: () => number;
  /** ブートストラップ用の設定値の読み出し。未指定ならブートストラップは無効。 */
  secrets?: ISecretProvider;
  /** カウンタ・索引・ブートストラップの更新を直列化する。未指定なら排他しない(テスト用)。 */
  lock?: ILock;
}

async function withAuthLock<T>(deps: Pick<AccountsAuthDeps, "lock">, fn: () => Promise<T>): Promise<T> {
  return deps.lock ? deps.lock.withLock(AUTH_LOCK_KEY, AUTH_LOCK_TIMEOUT_MS, fn) : fn();
}

interface StoredCredential {
  salt: string;
  hash: string;
}

interface StoredSession {
  memberId: string;
  expiresAt: number;
}

async function readMembers(storage: IKeyValueStorage): Promise<Member[]> {
  const raw = await storage.get(MEMBERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeMembers(storage: IKeyValueStorage, members: Member[]): Promise<void> {
  await storage.set(MEMBERS_KEY, JSON.stringify(members));
}

/** 表示用の名簿(id/name のみ)。誰でも取得できるよう、管理者フラグ等は含めない。 */
export async function listMembers(deps: AccountsUseCaseDeps): Promise<Member[]> {
  const members = await readMembers(deps.storage);
  return members.map((m) => ({ id: m.id, name: m.name }));
}

/** 管理画面用の一覧。isAdmin / hasPassword を含む。 */
export async function listAccounts(deps: AccountsUseCaseDeps): Promise<Member[]> {
  const members = await readMembers(deps.storage);
  return Promise.all(
    members.map(async (m) =>
      (await readCredential(deps.storage, m.id)) ? { ...m, hasPassword: true } : m
    )
  );
}

export async function findMemberById(deps: AccountsUseCaseDeps, id: string): Promise<Member | null> {
  const members = await readMembers(deps.storage);
  return members.find((m) => m.id === id) ?? null;
}

export async function addMember(
  deps: AccountsUseCaseDeps,
  args: { id?: string; name: string; isAdmin?: boolean }
): Promise<Member> {
  const name = args.name.trim();
  if (!name) throw new Error("name is required");
  const members = await readMembers(deps.storage);
  const id = args.id?.trim() || deps.generateId();
  if (members.some((m) => m.id === id)) {
    throw new Error(`Member with id "${id}" already exists`);
  }
  const created: Member = args.isAdmin ? { id, name, isAdmin: true } : { id, name };
  await writeMembers(deps.storage, [...members, created]);
  return created;
}

export async function updateMember(deps: AccountsUseCaseDeps, member: Member): Promise<Member> {
  const members = await readMembers(deps.storage);
  const index = members.findIndex((m) => m.id === member.id);
  if (index === -1) {
    throw new Error(`Member with id "${member.id}" not found`);
  }
  // isAdmin 省略時は既存値を保つ(ゲーム側の同期などが管理者権限を落とさないように)。
  const isAdmin = member.isAdmin ?? members[index].isAdmin;
  const updated: Member = isAdmin
    ? { id: member.id, name: member.name, isAdmin: true }
    : { id: member.id, name: member.name };
  const next = [...members];
  next[index] = updated;
  await writeMembers(deps.storage, next);
  return updated;
}

export async function deleteMember(deps: AccountsUseCaseDeps, id: string): Promise<void> {
  const members = await readMembers(deps.storage);
  await writeMembers(
    deps.storage,
    members.filter((m) => m.id !== id)
  );
  await deps.storage.deleteScalar(CREDENTIAL_KEY_PREFIX + id);
}

/**
 * マスタへ id ベースでupsertする(bulk-syncのような一括反映用)。
 * 既存メンバーのうち入力に含まれないものは削除しない
 * (マスタは他モジュールとも共有されているため、一括置換で消してはいけない)。
 */
export async function replaceAllMembers(
  deps: AccountsUseCaseDeps,
  members: Member[]
): Promise<{ replaced: number }> {
  const current = await readMembers(deps.storage);
  const byId = new Map(current.map((m) => [m.id, m] as const));
  for (const member of members) {
    const id = member.id?.trim() || deps.generateId();
    // 一括同期では管理者権限を付与も剥奪もしない(既存値を保つ)。
    const isAdmin = byId.get(id)?.isAdmin;
    byId.set(id, isAdmin ? { id, name: member.name, isAdmin: true } : { id, name: member.name });
  }
  await writeMembers(deps.storage, Array.from(byId.values()));
  return { replaced: members.length };
}

async function readCredential(storage: IKeyValueStorage, id: string): Promise<StoredCredential | null> {
  const raw = await storage.get(CREDENTIAL_KEY_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCredential;
  } catch {
    return null;
  }
}

/** タイミング差でハッシュが推測されにくいよう、長さが同じなら全桁を比較する。 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function setPassword(
  deps: AccountsAuthDeps,
  args: { id: string; password: string }
): Promise<void> {
  if (args.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!(await findMemberById(deps, args.id))) {
    throw new Error(`Member with id "${args.id}" not found`);
  }
  const salt = deps.generateId();
  const hash = await deps.hasher.hash(args.password, salt);
  const credential: StoredCredential = { salt, hash };
  await deps.storage.set(CREDENTIAL_KEY_PREFIX + args.id, JSON.stringify(credential));
}

/** ID/パスワードの不一致。リトライしても結果が変わらないため、クライアントには再試行させない。 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid id or password");
    this.name = "InvalidCredentialsError";
  }
}

/** 連続失敗でロック中。正しいパスワードでも拒否する。リトライしても無駄なので再試行させない。 */
export class LoginLockedError extends Error {
  constructor() {
    super("Too many failed attempts. Please try again later.");
    this.name = "LoginLockedError";
  }
}

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

async function readAttempt(storage: IKeyValueStorage, key: string): Promise<AttemptRecord | null> {
  const raw = await storage.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AttemptRecord;
  } catch {
    return null;
  }
}

/** この試行を数えるカウンタのキーと上限。実在のID(とブートストラップID)のみ個別に数える。 */
function attemptTarget(id: string, tracked: boolean): { key: string; limit: number } {
  return tracked
    ? { key: ATTEMPT_KEY_PREFIX + id, limit: MAX_LOGIN_FAILURES }
    : { key: GLOBAL_ATTEMPT_KEY, limit: MAX_GLOBAL_LOGIN_FAILURES };
}

async function assertNotLocked(deps: AccountsAuthDeps, key: string): Promise<void> {
  const record = await readAttempt(deps.storage, key);
  if (record && record.lockedUntil > deps.now()) throw new LoginLockedError();
}

async function recordFailure(deps: AccountsAuthDeps, target: { key: string; limit: number }): Promise<void> {
  await withAuthLock(deps, async () => {
    const now = deps.now();
    const current = await readAttempt(deps.storage, target.key);
    // ロック期間が過ぎていたら数え直す。
    const lockExpired = current !== null && current.lockedUntil !== 0 && current.lockedUntil <= now;
    const count = lockExpired ? 1 : (current?.count ?? 0) + 1;
    const next: AttemptRecord = { count, lockedUntil: count >= target.limit ? now + LOGIN_LOCK_MS : 0 };
    await deps.storage.set(target.key, JSON.stringify(next));
  });
}

async function clearAttempts(deps: AccountsAuthDeps, key: string): Promise<void> {
  if (await readAttempt(deps.storage, key)) await deps.storage.deleteScalar(key);
}

/** 管理者かつパスワード設定済みのメンバーが1人でもいるか。 */
async function hasLoginableAdmin(storage: IKeyValueStorage, members: Member[]): Promise<boolean> {
  for (const m of members) {
    if (m.isAdmin && (await readCredential(storage, m.id))) return true;
  }
  return false;
}

/**
 * ブートストラップが有効なら、その ID とパスワードを返す。
 * 条件: シークレットが設定済みで最小長以上、かつログイン可能な管理者が0人。
 * 管理者が1人でもログインできるようになった時点で無効になる(シークレットを残しても裏口にならない)。
 */
async function activeBootstrap(
  deps: AccountsAuthDeps,
  members: Member[]
): Promise<{ id: string; password: string } | null> {
  const password = deps.secrets?.get(BOOTSTRAP_PASSWORD_SECRET);
  if (!password || password.length < MIN_PASSWORD_LENGTH) return null;
  if (await hasLoginableAdmin(deps.storage, members)) return null;
  return { id: deps.secrets?.get(BOOTSTRAP_ID_SECRET)?.trim() || DEFAULT_BOOTSTRAP_ID, password };
}

/** 排他の中で再確認したうえで、ブートストラップ管理者を作成(既存なら管理者化)してパスワードを設定する。 */
async function createBootstrapAdmin(deps: AccountsAuthDeps, id: string, password: string): Promise<Member | null> {
  return withAuthLock(deps, async () => {
    const members = await readMembers(deps.storage);
    if (await hasLoginableAdmin(deps.storage, members)) return null;
    const existing = members.find((m) => m.id === id);
    if (existing) {
      await writeMembers(
        deps.storage,
        members.map((m) => (m.id === id ? { id: m.id, name: m.name, isAdmin: true } : m))
      );
    } else {
      await writeMembers(deps.storage, [...members, { id, name: BOOTSTRAP_ADMIN_NAME, isAdmin: true }]);
    }
    await setPassword(deps, { id, password });
    return findMemberById(deps, id);
  });
}

/** ID/パスワードを検証し、セッショントークンを発行する。失敗理由は区別しない。 */
export async function login(
  deps: AccountsAuthDeps,
  args: { id: string; password: string }
): Promise<LoginResult> {
  const invalid = new InvalidCredentialsError();
  const members = await readMembers(deps.storage);
  const bootstrap = await activeBootstrap(deps, members);
  let member = members.find((m) => m.id === args.id) ?? null;
  const target = attemptTarget(args.id, member !== null || bootstrap?.id === args.id);
  await assertNotLocked(deps, target.key);

  const bootstrapMatch =
    bootstrap !== null && bootstrap.id === args.id && constantTimeEquals(args.password, bootstrap.password);
  if (bootstrapMatch) {
    member = await createBootstrapAdmin(deps, bootstrap.id, bootstrap.password);
  } else {
    const credential = member ? await readCredential(deps.storage, args.id) : null;
    const hash = credential ? await deps.hasher.hash(args.password, credential.salt) : null;
    if (!member || !credential || hash === null || !constantTimeEquals(hash, credential.hash)) {
      await recordFailure(deps, target);
      throw invalid;
    }
  }
  if (!member) {
    await recordFailure(deps, target);
    throw invalid;
  }

  await clearAttempts(deps, target.key);
  const token = await issueSession(deps, member.id);
  return { token, member };
}

/** セッションを発行し、索引に載せる。期限切れと、上限を超えた古いセッションはここで実削除する。 */
async function issueSession(deps: AccountsAuthDeps, memberId: string): Promise<string> {
  const token = deps.generateId();
  const now = deps.now();
  const session: StoredSession = { memberId, expiresAt: now + SESSION_TTL_MS };
  await withAuthLock(deps, async () => {
    const index = await readSessionIndex(deps.storage);
    const expired = index.filter(([, expiresAt]) => expiresAt <= now);
    const alive = [...index.filter(([, expiresAt]) => expiresAt > now), [token, session.expiresAt] as [string, number]];
    const overflow = Math.max(0, alive.length - MAX_ACTIVE_SESSIONS);
    for (const [old] of [...expired, ...alive.slice(0, overflow)]) {
      await deps.storage.deleteScalar(SESSION_KEY_PREFIX + old);
    }
    await deps.storage.set(SESSION_KEY_PREFIX + token, JSON.stringify(session));
    await deps.storage.set(SESSION_INDEX_KEY, JSON.stringify(alive.slice(overflow)));
  });
  return token;
}

async function readSessionIndex(storage: IKeyValueStorage): Promise<Array<[string, number]>> {
  const raw = await storage.get(SESSION_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** トークンを無効化する。索引に残った分は次回ログイン時の掃除で消える。 */
export async function logout(deps: AccountsUseCaseDeps, token: string): Promise<void> {
  if (!token) return;
  await deps.storage.deleteScalar(SESSION_KEY_PREFIX + token);
}

/** 有効なセッションならメンバーを返す。無効・期限切れ・メンバー削除済みなら null。 */
export async function getSession(
  deps: Pick<AccountsAuthDeps, "storage" | "now">,
  token: string
): Promise<Member | null> {
  if (!token) return null;
  const raw = await deps.storage.get(SESSION_KEY_PREFIX + token);
  if (!raw) return null;
  let session: StoredSession;
  try {
    session = JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
  if (session.expiresAt <= deps.now()) return null;
  const members = await readMembers(deps.storage);
  return members.find((m) => m.id === session.memberId) ?? null;
}
