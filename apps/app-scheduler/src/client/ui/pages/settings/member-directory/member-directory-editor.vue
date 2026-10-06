<template>
    <div class="member-directory-editor">
        <p class="member-directory-editor__description">
            ここで登録したメンバーは、各ゲーム(ジャックポット・クイズなど)の管理画面から共通の名簿として参照できます。
        </p>
        <MemberEditor :members="members" :loading="loading" :on-add="addMember" :on-update="updateMember"
            :on-delete="deleteMembers" />
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { container } from 'tsyringe';
import { MemberEditor, toast } from '@octopus/ui-kit';
import { MemberDirectoryRepository } from '@octopus/member-directory';
import type { Member } from '@octopus/member-directory';

const repo = container.resolve(MemberDirectoryRepository);
const members = ref<Member[]>([]);
const loading = ref(true);

const load = async () => {
    try {
        members.value = await repo.listMembers();
    } catch (error) {
        console.error('Failed to fetch members:', error);
        toast.error('メンバー一覧の取得に失敗しました');
    } finally {
        loading.value = false;
    }
};

const addMember = async (input: { id?: string; name: string }) => {
    members.value = [...members.value, await repo.addMember(input)];
};

const updateMember = async (input: Member) => {
    const updated = await repo.updateMember(input);
    members.value = members.value.map((m) => (m.id === updated.id ? updated : m));
};

const deleteMembers = async (ids: string[]) => {
    for (const id of ids) {
        await repo.deleteMember(id);
        members.value = members.value.filter((m) => m.id !== id);
    }
};

onMounted(load);
</script>

<style scoped>
.member-directory-editor__description {
    margin: 0 0 var(--ui-space-3, 12px);
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
