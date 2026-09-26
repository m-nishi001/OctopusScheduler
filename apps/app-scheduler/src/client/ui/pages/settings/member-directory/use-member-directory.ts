import { ref, computed } from "vue";
import { container } from "tsyringe";
import { MemberDirectoryRepository } from "@octopus/member-directory";
import type { Member } from "@octopus/member-directory";

export interface MemberFormInput {
  /** 追加時のみ有効。未指定ならサーバー側で自動採番される。 */
  id?: string;
  name: string;
}

export function useMemberDirectory(repoArg?: MemberDirectoryRepository) {
  const repo = repoArg || container.resolve(MemberDirectoryRepository);

  const members = ref<Member[]>([]);
  const selectedMembers = ref<string[]>([]);
  const deleting = ref(false);
  const deleteMessage = ref("");

  const isAllSelected = computed({
    get: () =>
      members.value.length > 0 &&
      selectedMembers.value.length === members.value.length,
    set: (val: boolean) => {
      selectedMembers.value = val ? members.value.map((m) => m.id) : [];
    },
  });

  const fetchMembers = async () => {
    try {
      members.value = await repo.listMembers();
    } catch (error) {
      console.error("Failed to fetch members:", error);
      members.value = [];
    }
  };

  const addMember = async (input: MemberFormInput): Promise<Member> => {
    const added = await repo.addMember({
      id: input.id?.trim() || undefined,
      name: input.name.trim(),
    });
    members.value.push(added);
    return added;
  };

  const updateMember = async (original: Member, input: MemberFormInput): Promise<void> => {
    const updated = await repo.updateMember({ id: original.id, name: input.name.trim() });
    const index = members.value.findIndex((m) => m.id === updated.id);
    if (index !== -1) members.value[index] = updated;
  };

  const deleteMember = async (id: string): Promise<void> => {
    deleting.value = true;
    deleteMessage.value = "メンバーを削除しています...";
    try {
      await repo.deleteMember(id);
      members.value = members.value.filter((m) => m.id !== id);
      selectedMembers.value = selectedMembers.value.filter((sid) => sid !== id);
    } catch (error) {
      console.error("Failed to delete member:", error);
    } finally {
      deleting.value = false;
    }
  };

  const deleteSelectedMembers = async (): Promise<void> => {
    if (!selectedMembers.value.length) return;
    deleting.value = true;
    deleteMessage.value = "メンバーを削除しています...";
    try {
      const ids = [...selectedMembers.value];
      for (const id of ids) {
        await repo.deleteMember(id);
      }
      members.value = members.value.filter((m) => !ids.includes(m.id));
      selectedMembers.value = [];
    } catch (error) {
      console.error("Failed to delete members:", error);
    } finally {
      deleting.value = false;
    }
  };

  return {
    members,
    selectedMembers,
    isAllSelected,
    deleting,
    deleteMessage,
    fetchMembers,
    addMember,
    updateMember,
    deleteMember,
    deleteSelectedMembers,
  };
}
