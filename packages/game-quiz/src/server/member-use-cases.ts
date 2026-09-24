import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { Member } from "./quiz-api-contract";

export interface MemberUseCaseDeps {
  storage: IKeyValueStorage;
}

const MEMBERS_KEY = "quiz-game-members";

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

export function listMembers(deps: MemberUseCaseDeps): Member[] {
  return readMembers(deps.storage);
}

export function addMember(deps: MemberUseCaseDeps, member: Member): Member {
  const userId = member.userId.trim();
  if (!userId) throw new Error("userId is required");
  const members = readMembers(deps.storage);
  if (members.some((m) => m.userId === userId)) {
    throw new Error(`Member with userId "${userId}" already exists`);
  }
  const created: Member = { userId, displayName: member.displayName };
  writeMembers(deps.storage, [...members, created]);
  return created;
}

export function updateMember(deps: MemberUseCaseDeps, member: Member): Member {
  const members = readMembers(deps.storage);
  const index = members.findIndex((m) => m.userId === member.userId);
  if (index === -1) {
    throw new Error(`Member with userId "${member.userId}" not found`);
  }
  const updated: Member = { userId: member.userId, displayName: member.displayName };
  const next = [...members];
  next[index] = updated;
  writeMembers(deps.storage, next);
  return updated;
}

export function deleteMember(deps: MemberUseCaseDeps, userId: string): void {
  const members = readMembers(deps.storage);
  writeMembers(
    deps.storage,
    members.filter((m) => m.userId !== userId)
  );
}
