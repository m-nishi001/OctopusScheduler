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
import { onMounted } from 'vue';
import { container } from 'tsyringe';
import { MemberEditor, toast } from '@octopus/ui-kit';
import { useCachedCollection } from '@octopus/composables';
import { AccountsRepository } from '@octopus/accounts';
import type { Member } from '@octopus/accounts';

const repo = container.resolve(AccountsRepository);

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

<style scoped>
.member-directory-editor__description {
    margin: 0 0 var(--ui-space-3, 12px);
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
