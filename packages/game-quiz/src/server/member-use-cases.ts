import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type { Member } from "./quiz-api-contract";

export interface MemberUseCaseDeps {
  storage: IKeyValueStorage;
}

const MEMBERS_KEY = "quiz-game-members";

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

export async function listMembers(deps: MemberUseCaseDeps): Promise<Member[]> {
  return readMembers(deps.storage);
}

export async function findMemberByUserId(
  deps: MemberUseCaseDeps,
  userId: string
): Promise<Member | null> {
  const members = await readMembers(deps.storage);
  return members.find((m) => m.userId === userId) ?? null;
}

export async function addMember(deps: MemberUseCaseDeps, member: Member): Promise<Member> {
  const userId = member.userId.trim();
  if (!userId) throw new Error("userId is required");
  const members = await readMembers(deps.storage);
  if (members.some((m) => m.userId === userId)) {
    throw new Error(`Member with userId "${userId}" already exists`);
  }
  const created: Member = { userId, displayName: member.displayName };
  await writeMembers(deps.storage, [...members, created]);
  return created;
}

export async function updateMember(deps: MemberUseCaseDeps, member: Member): Promise<Member> {
  const members = await readMembers(deps.storage);
  const index = members.findIndex((m) => m.userId === member.userId);
  if (index === -1) {
    throw new Error(`Member with userId "${member.userId}" not found`);
  }
  const updated: Member = { userId: member.userId, displayName: member.displayName };
  const next = [...members];
  next[index] = updated;
  await writeMembers(deps.storage, next);
  return updated;
}

export async function deleteMember(deps: MemberUseCaseDeps, userId: string): Promise<void> {
  const members = await readMembers(deps.storage);
  await writeMembers(
    deps.storage,
    members.filter((m) => m.userId !== userId)
  );
}
