import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { Member } from "./member-directory-api-contract";

export interface MemberDirectoryUseCaseDeps {
  storage: IKeyValueStorage;
  /** id省略時の採番。GAS本番では Utilities.getUuid() を注入する。 */
  generateId: () => string;
}

const MEMBERS_KEY = "member-directory-members";

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

export async function listMembers(deps: MemberDirectoryUseCaseDeps): Promise<Member[]> {
  return readMembers(deps.storage);
}

export async function findMemberById(deps: MemberDirectoryUseCaseDeps, id: string): Promise<Member | null> {
  const members = await readMembers(deps.storage);
  return members.find((m) => m.id === id) ?? null;
}

export async function addMember(
  deps: MemberDirectoryUseCaseDeps,
  args: { id?: string; name: string }
): Promise<Member> {
  const name = args.name.trim();
  if (!name) throw new Error("name is required");
  const members = await readMembers(deps.storage);
  const id = args.id?.trim() || deps.generateId();
  if (members.some((m) => m.id === id)) {
    throw new Error(`Member with id "${id}" already exists`);
  }
  const created: Member = { id, name };
  await writeMembers(deps.storage, [...members, created]);
  return created;
}

export async function updateMember(deps: MemberDirectoryUseCaseDeps, member: Member): Promise<Member> {
  const members = await readMembers(deps.storage);
  const index = members.findIndex((m) => m.id === member.id);
  if (index === -1) {
    throw new Error(`Member with id "${member.id}" not found`);
  }
  const updated: Member = { id: member.id, name: member.name };
  const next = [...members];
  next[index] = updated;
  await writeMembers(deps.storage, next);
  return updated;
}

export async function deleteMember(deps: MemberDirectoryUseCaseDeps, id: string): Promise<void> {
  const members = await readMembers(deps.storage);
  await writeMembers(
    deps.storage,
    members.filter((m) => m.id !== id)
  );
}

/**
 * マスタへ id ベースでupsertする(bulk-syncのような一括反映用)。
 * 既存メンバーのうち入力に含まれないものは削除しない
 * (マスタは他モジュールとも共有されているため、一括置換で消してはいけない)。
 */
export async function replaceAllMembers(
  deps: MemberDirectoryUseCaseDeps,
  members: Member[]
): Promise<{ replaced: number }> {
  const current = await readMembers(deps.storage);
  const byId = new Map(current.map((m) => [m.id, m] as const));
  for (const member of members) {
    const id = member.id?.trim() || deps.generateId();
    byId.set(id, { id, name: member.name });
  }
  await writeMembers(deps.storage, Array.from(byId.values()));
  return { replaced: members.length };
}
