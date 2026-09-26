import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { Member } from "./member-directory-api-contract";

export interface MemberDirectoryUseCaseDeps {
  storage: IKeyValueStorage;
  /** id省略時の採番。GAS本番では Utilities.getUuid() を注入する。 */
  generateId: () => string;
}

const MEMBERS_KEY = "member-directory-members";

function readMembers(storage: IKeyValueStorage): Member[] {
  const raw = storage.get(MEMBERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMembers(storage: IKeyValueStorage, members: Member[]): void {
  storage.set(MEMBERS_KEY, JSON.stringify(members));
}

export function listMembers(deps: MemberDirectoryUseCaseDeps): Member[] {
  return readMembers(deps.storage);
}

export function findMemberById(deps: MemberDirectoryUseCaseDeps, id: string): Member | null {
  const members = readMembers(deps.storage);
  return members.find((m) => m.id === id) ?? null;
}

export function addMember(
  deps: MemberDirectoryUseCaseDeps,
  args: { id?: string; name: string }
): Member {
  const name = args.name.trim();
  if (!name) throw new Error("name is required");
  const members = readMembers(deps.storage);
  const id = args.id?.trim() || deps.generateId();
  if (members.some((m) => m.id === id)) {
    throw new Error(`Member with id "${id}" already exists`);
  }
  const created: Member = { id, name };
  writeMembers(deps.storage, [...members, created]);
  return created;
}

export function updateMember(deps: MemberDirectoryUseCaseDeps, member: Member): Member {
  const members = readMembers(deps.storage);
  const index = members.findIndex((m) => m.id === member.id);
  if (index === -1) {
    throw new Error(`Member with id "${member.id}" not found`);
  }
  const updated: Member = { id: member.id, name: member.name };
  const next = [...members];
  next[index] = updated;
  writeMembers(deps.storage, next);
  return updated;
}

export function deleteMember(deps: MemberDirectoryUseCaseDeps, id: string): void {
  const members = readMembers(deps.storage);
  writeMembers(
    deps.storage,
    members.filter((m) => m.id !== id)
  );
}

/**
 * マスタへ id ベースでupsertする(bulk-syncのような一括反映用)。
 * 既存メンバーのうち入力に含まれないものは削除しない
 * (マスタは他モジュールとも共有されているため、一括置換で消してはいけない)。
 */
export function replaceAllMembers(
  deps: MemberDirectoryUseCaseDeps,
  members: Member[]
): { replaced: number } {
  const current = readMembers(deps.storage);
  const byId = new Map(current.map((m) => [m.id, m] as const));
  for (const member of members) {
    const id = member.id?.trim() || deps.generateId();
    byId.set(id, { id, name: member.name });
  }
  writeMembers(deps.storage, Array.from(byId.values()));
  return { replaced: members.length };
}
