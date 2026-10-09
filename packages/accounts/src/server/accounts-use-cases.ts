import type { IKeyValueStorage, IPasswordHasher } from "@octopus/infrastructures/interfaces";
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

/** 認証系ユースケースが追加で必要とする依存。 */
export interface AccountsAuthDeps extends AccountsUseCaseDeps {
  hasher: IPasswordHasher;
  /** 現在時刻(ms)。テストで差し替える。 */
  now: () => number;
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

export async function listMembers(deps: AccountsUseCaseDeps): Promise<Member[]> {
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
  await deps.storage.set(CREDENTIAL_KEY_PREFIX + id, "");
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

/** ID/パスワードを検証し、セッショントークンを発行する。失敗理由は区別しない。 */
export async function login(
  deps: AccountsAuthDeps,
  args: { id: string; password: string }
): Promise<LoginResult> {
  const invalid = new Error("Invalid id or password");
  const member = await findMemberById(deps, args.id);
  const credential = member ? await readCredential(deps.storage, args.id) : null;
  if (!member || !credential) throw invalid;
  const hash = await deps.hasher.hash(args.password, credential.salt);
  if (!constantTimeEquals(hash, credential.hash)) throw invalid;

  const token = deps.generateId();
  const session: StoredSession = { memberId: member.id, expiresAt: deps.now() + SESSION_TTL_MS };
  await deps.storage.set(SESSION_KEY_PREFIX + token, JSON.stringify(session));
  return { token, member };
}

/** トークンを無効化する(スカラーは削除できないため空文字で上書きする)。 */
export async function logout(deps: AccountsUseCaseDeps, token: string): Promise<void> {
  if (!token) return;
  await deps.storage.set(SESSION_KEY_PREFIX + token, "");
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
