<template>
    <MemberEditor :members="members" :loading="loading" id-required :on-add="addMember" :on-update="updateMember"
        :on-delete="deleteMembers" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { container } from 'tsyringe';
import { MemberEditor, toast } from '@octopus/ui-kit';
import { MemberDirectoryRepository } from '@octopus/member-directory';
import type { Member } from '@octopus/member-directory';

/**
 * クイズの「メンバー」は共有マスタそのもの。マスタの id を参加者ログイン時に入力する
 * 人間可読なログインコードとして使うため、追加時は ID を必須にする。
 */
const repo = container.resolve(MemberDirectoryRepository);
const members = ref<Member[]>([]);
const loading = ref(true);

async function load() {
    try {
        members.value = await repo.listMembers();
    } catch {
        toast.error('メンバー一覧の取得に失敗しました');
    } finally {
        loading.value = false;
    }
}

onMounted(load);

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
</script>
