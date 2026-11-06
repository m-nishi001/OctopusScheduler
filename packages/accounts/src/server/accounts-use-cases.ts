import { utf8ByteLength } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage, ILock, IPasswordHasher, ISecretProvider } from "@octopus/infrastructures/interfaces";
import type { LoginResult, Member, RosterUsage } from "./accounts-api-contract";
import { deleteMemberPhotos } from "./member-photos";
import {
  addMemberToRoster,
  applyRosterChange,
  deleteMemberFromRoster,
  ensureAdminInRoster,
  toPublicMember,
  updateMemberInRoster,
} from "./roster-domain";
import type { MemberInput } from "./roster-domain";

export interface AccountsUseCaseDeps {
  storage: IKeyValueStorage;
  /** id省略時の採番。GAS本番では Utilities.getUuid() を注入する。 */
  generateId: () => string;
  /** 名簿・カウンタ・索引の更新を直列化する(読んで書き換える更新が同時に走ると、片方の更新が失われるため)。未指定なら排他しない(テスト用)。 */
  lock?: ILock;
}

const MEMBERS_KEY = "member-directory-members";
const CREDENTIAL_KEY_PREFIX = "accounts-credential/";
const SESSION_KEY_PREFIX = "accounts-session/";
/** 受付QR用のログインキー(ハッシュのみ保存)。 */
const LOGIN_KEY_PREFIX = "accounts-login-key/";
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

/**
 * メンバーごとのセッション一覧(トークンと期限)。ログインの排他はメンバー単位なので、
 * 受付QRで参加者が一斉にログインしても、別のメンバー同士は互いを待たない。
 * 全体の件数は「メンバー数 × MAX_SESSIONS_PER_MEMBER」までで、GAS の ScriptProperty の容量にも収まる。
 */
const MEMBER_SESSIONS_KEY_PREFIX = "accounts-member-sessions/";
/** 1人が同時に持てるセッション数。超えたら、そのメンバーの古いものから失効する(端末の買い替えや複数端末を許す程度)。 */
export const MAX_SESSIONS_PER_MEMBER = 10;

/** 排他の待ち時間。 */
const LOCK_TIMEOUT_MS = 10_000;
/** ログインの失敗回数・初回管理者の作成。 */
const AUTH_LOCK_KEY = "accounts-auth";
/** 名簿(メンバー一覧)の更新。ログインの排他とは別のキーなので、ログインを待たせない。 */
const ROSTER_LOCK_KEY = "accounts-roster";
/** 1人のメンバーのセッション一覧の更新。 */
const sessionsLockKey = (memberId: string): string => `accounts-sessions-${memberId}`;

/** 認証系ユースケースが追加で必要とする依存。 */
export interface AccountsAuthDeps extends AccountsUseCaseDeps {
  hasher: IPasswordHasher;
  /** 現在時刻(ms)。テストで差し替える。 */
  now: () => number;
  /** ブートストラップ用の設定値の読み出し。未指定ならブートストラップは無効。 */
  secrets?: ISecretProvider;
}

/** 排他のもとで fn を実行する。lock が無いとき(テスト)は、そのまま実行する。 */
async function withLock<T>(deps: Pick<AccountsUseCaseDeps, "lock">, key: string, fn: () => Promise<T>): Promise<T> {
  return deps.lock ? deps.lock.withLock(key, LOCK_TIMEOUT_MS, fn) : fn();
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

/** 名簿の容量の使用状況。上限に近いかどうかを管理画面が判断する。 */
export async function getRosterUsage(deps: AccountsUseCaseDeps): Promise<RosterUsage> {
  const raw = (await deps.storage.get(MEMBERS_KEY)) ?? "[]";
  return {
    members: (await readMembers(deps.storage)).length,
    usedBytes: utf8ByteLength(raw),
    maxBytes: deps.storage.maxScalarBytes ?? null,
  };
}

/** メンバーの一覧(id・名前・写真のハッシュ)。誰でも取得できるよう、管理者フラグ等は含めない。 */
export async function listMembers(deps: AccountsUseCaseDeps): Promise<Member[]> {
  const members = await readMembers(deps.storage);
  return members.map(toPublicMember);
}

/** 管理画面用の一覧。isAdmin / hasPassword / hasLoginKey を含む。 */
export async function listAccounts(deps: AccountsUseCaseDeps): Promise<Member[]> {
  const members = await readMembers(deps.storage);
  return Promise.all(
    members.map(async (m) => {
      const listed: Member = { ...m };
      if (await readCredential(deps.storage, m.id)) listed.hasPassword = true;
      if (await readLoginKey(deps.storage, m.id)) listed.hasLoginKey = true;
      return listed;
    })
  );
}

/** id でメンバーを探す。無ければ null。 */
export async function findMemberById(deps: AccountsUseCaseDeps, id: string): Promise<Member | null> {
  const members = await readMembers(deps.storage);
  return members.find((m) => m.id === id) ?? null;
}

/** 名簿から外れた写真のファイルを消す。名簿のロックの外で行う(消すのに時間がかかっても、名簿の更新を待たせない)。 */
async function discardPhotos(deps: AccountsUseCaseDeps, orphanPhotos: string[]): Promise<void> {
  if (orphanPhotos.length > 0) await deleteMemberPhotos(deps, orphanPhotos);
}

/** メンバーを追加する。名前は必須で、id を省略すると自動で付ける。同じ id が既にあればエラー。名簿のロックの中で行う。 */
export async function addMember(deps: AccountsUseCaseDeps, args: MemberInput): Promise<Member> {
  return withLock(deps, ROSTER_LOCK_KEY, async () => {
    const { next, member } = addMemberToRoster(await readMembers(deps.storage), args, deps.generateId);
    await writeMembers(deps.storage, next);
    return member;
  });
}

/** メンバーを更新する。名簿のロックの中で行う。いなければエラー。`isAdmin` / `photo` の省略は、いまの値を保つ。 */
export async function updateMember(deps: AccountsUseCaseDeps, input: MemberInput & { id: string }): Promise<Member> {
  const { member, orphanPhotos } = await withLock(deps, ROSTER_LOCK_KEY, async () => {
    const change = updateMemberInRoster(await readMembers(deps.storage), input);
    await writeMembers(deps.storage, change.next);
    return change;
  });
  await discardPhotos(deps, orphanPhotos);
  return member;
}

/** メンバーを削除する。名簿のロックの中で行う。 */
export async function deleteMember(deps: AccountsUseCaseDeps, id: string): Promise<void> {
  const { orphanPhotos } = await withLock(deps, ROSTER_LOCK_KEY, async () => {
    const change = deleteMemberFromRoster(await readMembers(deps.storage), id);
    await writeMembers(deps.storage, change.next);
    return change;
  });
  await discardPhotos(deps, orphanPhotos);
  await purgeMemberData(deps, id);
}

/** 名簿から外れたメンバーの、セッション・パスワード・受付QRのキーを消す。名簿のロックの外で行う。 */
async function purgeMemberData(deps: AccountsUseCaseDeps, id: string): Promise<void> {
  await revokeMemberSessions(deps, id);
  await deps.storage.deleteScalar(CREDENTIAL_KEY_PREFIX + id);
  await deps.storage.deleteScalar(LOGIN_KEY_PREFIX + id);
}

/**
 * CSV 取込の確定。追加・更新(id ベースの upsert)と削除を、名簿のロックの中で1回だけ書く。
 * 管理者が `deleteIds` に含まれていれば、名簿を変えずに全体を拒否する。
 * 削除したメンバーの写真・セッション・パスワード・受付QRのキーは、書き込みのあとに片づける。
 */
export async function applyRoster(
  deps: AccountsUseCaseDeps,
  input: { upserts: MemberInput[]; deleteIds: string[] }
): Promise<{ upserted: number; deleted: number }> {
  const deleteIds = [...new Set(input.deleteIds)];
  const { removed, orphanPhotos } = await withLock(deps, ROSTER_LOCK_KEY, async () => {
    const roster = await readMembers(deps.storage);
    const change = applyRosterChange(roster, { upserts: input.upserts, deleteIds }, deps.generateId);
    await writeMembers(deps.storage, change.next);
    const existing = new Set(roster.map((m) => m.id));
    return { removed: deleteIds.filter((id) => existing.has(id)), orphanPhotos: change.orphanPhotos };
  });
  await discardPhotos(deps, orphanPhotos);
  await Promise.all(removed.map((id) => purgeMemberData(deps, id)));
  return { upserted: input.upserts.length, deleted: removed.length };
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

/** パスワードを設定する。最低の長さに満たなければエラー。 */
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
  await withLock(deps, AUTH_LOCK_KEY, async () => {
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
  return withLock(deps, AUTH_LOCK_KEY, async () => {
    const members = await readMembers(deps.storage);
    if (await hasLoginableAdmin(deps.storage, members)) return null;
    await writeMembers(deps.storage, ensureAdminInRoster(members, id, BOOTSTRAP_ADMIN_NAME));
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

async function readLoginKey(storage: IKeyValueStorage, id: string): Promise<StoredCredential | null> {
  const raw = await storage.get(LOGIN_KEY_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCredential;
  } catch {
    return null;
  }
}

/**
 * 参加者(管理者以外)の受付QR用ログインキーを発行する。平文は戻り値でしか見られず、保存はハッシュのみ。
 * 再発行すると古いキーは無効になる。キーはUUID2つ分(約244ビット)のランダム値で、総当たりは成立しない。
 * 管理者は対象外(印刷物のQRが管理者権限の入口になるのを避ける)。
 */
export async function issueLoginKey(deps: AccountsAuthDeps, args: { id: string }): Promise<{ key: string }> {
  const member = await findMemberById(deps, args.id);
  if (!member) throw new Error(`Member with id "${args.id}" not found`);
  if (member.isAdmin) throw new Error("Login keys can only be issued to non-admin members");
  const key = (deps.generateId() + deps.generateId()).replace(/-/g, "");
  const salt = deps.generateId();
  const stored: StoredCredential = { salt, hash: await deps.hasher.hash(key, salt) };
  await deps.storage.set(LOGIN_KEY_PREFIX + args.id, JSON.stringify(stored));
  return { key };
}

/** メンバーの受付QRのログインキーを無効にする。 */
export async function revokeLoginKey(deps: AccountsUseCaseDeps, args: { id: string }): Promise<void> {
  await deps.storage.deleteScalar(LOGIN_KEY_PREFIX + args.id);
}

/**
 * 受付QRのキーで参加者としてログインする。失敗理由は区別せず、パスワードログインと同じ
 * ID単位の失敗カウンタ・ロックを共有する(キーを推測し続けても、ロックで止まる)。
 */
export async function loginWithKey(deps: AccountsAuthDeps, args: { id: string; key: string }): Promise<LoginResult> {
  const members = await readMembers(deps.storage);
  const member = members.find((m) => m.id === args.id) ?? null;
  const target = attemptTarget(args.id, member !== null);
  await assertNotLocked(deps, target.key);

  const stored = member && !member.isAdmin ? await readLoginKey(deps.storage, args.id) : null;
  const hash = stored ? await deps.hasher.hash(args.key, stored.salt) : null;
  if (!member || !stored || hash === null || !constantTimeEquals(hash, stored.hash)) {
    await recordFailure(deps, target);
    throw new InvalidCredentialsError();
  }

  await clearAttempts(deps, target.key);
  const token = await issueSession(deps, member.id);
  return { token, member };
}

/**
 * セッションを発行し、そのメンバーの一覧に載せる。期限切れと、メンバーごとの上限を超えた古いセッションは実削除する。
 * ロックの中は一覧の読み書きだけにする(セッション本体の保存と、古いセッションの削除はロックの外)。
 * 同じメンバーが同時にログインしても、順番に処理されるので、一覧への登録は失われない。
 */
async function issueSession(deps: AccountsAuthDeps, memberId: string): Promise<string> {
  const token = deps.generateId();
  const now = deps.now();
  const session: StoredSession = { memberId, expiresAt: now + SESSION_TTL_MS };
  await deps.storage.set(SESSION_KEY_PREFIX + token, JSON.stringify(session));
  const removed = await withLock(deps, sessionsLockKey(memberId), async () => {
    const list = await readMemberSessions(deps.storage, memberId);
    const alive = [...list.filter(([, expiresAt]) => expiresAt > now), [token, session.expiresAt] as SessionEntry];
    const overflow = Math.max(0, alive.length - MAX_SESSIONS_PER_MEMBER);
    await deps.storage.set(MEMBER_SESSIONS_KEY_PREFIX + memberId, JSON.stringify(alive.slice(overflow)));
    return [...list.filter(([, expiresAt]) => expiresAt <= now), ...alive.slice(0, overflow)].map(([old]) => old);
  });
  await Promise.all(removed.map((old) => deps.storage.deleteScalar(SESSION_KEY_PREFIX + old)));
  return token;
}

type SessionEntry = [token: string, expiresAt: number];

async function readMemberSessions(storage: IKeyValueStorage, memberId: string): Promise<SessionEntry[]> {
  const raw = await storage.get(MEMBER_SESSIONS_KEY_PREFIX + memberId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** メンバーのセッションをすべて無効にする(メンバー削除時)。 */
async function revokeMemberSessions(deps: AccountsUseCaseDeps, memberId: string): Promise<void> {
  const list = await withLock(deps, sessionsLockKey(memberId), async () => {
    const current = await readMemberSessions(deps.storage, memberId);
    await deps.storage.deleteScalar(MEMBER_SESSIONS_KEY_PREFIX + memberId);
    return current;
  });
  await Promise.all(list.map(([token]) => deps.storage.deleteScalar(SESSION_KEY_PREFIX + token)));
}

/** トークンを無効化する(そのメンバーの一覧からも外す)。 */
export async function logout(deps: AccountsUseCaseDeps, token: string): Promise<void> {
  if (!token) return;
  const raw = await deps.storage.get(SESSION_KEY_PREFIX + token);
  await deps.storage.deleteScalar(SESSION_KEY_PREFIX + token);
  const memberId = raw ? parseSession(raw)?.memberId : undefined;
  if (!memberId) return;
  await withLock(deps, sessionsLockKey(memberId), async () => {
    const list = await readMemberSessions(deps.storage, memberId);
    await deps.storage.set(MEMBER_SESSIONS_KEY_PREFIX + memberId, JSON.stringify(list.filter(([t]) => t !== token)));
  });
}

function parseSession(raw: string): StoredSession | null {
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/** 有効なセッションならメンバーを返す。無効・期限切れ・メンバー削除済みなら null。 */
export async function getSession(
  deps: Pick<AccountsAuthDeps, "storage" | "now">,
  token: string
): Promise<Member | null> {
  if (!token) return null;
  const raw = await deps.storage.get(SESSION_KEY_PREFIX + token);
  if (!raw) return null;
  const session = parseSession(raw);
  if (!session || session.expiresAt <= deps.now()) return null;
  const members = await readMembers(deps.storage);
  return members.find((m) => m.id === session.memberId) ?? null;
}
