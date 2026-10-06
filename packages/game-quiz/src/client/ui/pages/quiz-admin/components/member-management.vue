<template>
    <MemberEditor :members="members" :loading="loading" id-required :on-add="addMember" :on-update="updateMember"
        :on-delete="deleteMembers" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { container } from 'tsyringe';
import { MemberEditor, toast } from '@octopus/ui-kit';
import { useCachedCollection } from '@octopus/composables';
import { MemberDirectoryRepository } from '@octopus/member-directory';
import type { Member } from '@octopus/member-directory';

/**
 * クイズの「メンバー」は共有マスタそのもの。マスタの id を参加者ログイン時に入力する
 * 人間可読なログインコードとして使うため、追加時は ID を必須にする。
 */
const repo = container.resolve(MemberDirectoryRepository);

// IndexedDB のキャッシュを即表示し、背景で最新化。更新/削除は楽観的に反映する。
const { items: members, loading, error, load, add: addMember, update: updateMember, remove: deleteMembers } =
    useCachedCollection<Member, { id?: string; name: string }>({
        key: 'member-directory',
        list: () => repo.listMembers(),
        add: (input) => repo.addMember(input),
        update: (member) => repo.updateMember(member),
        remove: (id) => repo.deleteMember(id),
    });

onMounted(async () => {
    await load();
    if (error.value) toast.error('メンバー一覧の更新に失敗しました(保存済みの内容を表示しています)');
});
</script>
