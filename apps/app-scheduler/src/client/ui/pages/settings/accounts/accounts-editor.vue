<template>
    <section class="accounts-editor">
        <p v-if="!production" class="accounts-editor__notice">
            開発モードのため、ログインなしで管理画面を開けます。管理者を登録してパスワードを設定したら、
            <code>app-mode.config.json</code> を <code>production</code> にして再ビルド・デプロイしてください。
        </p>
        <p v-if="!hasLoginableAdmin" class="accounts-editor__warning" role="alert">
            パスワード設定済みの管理者がいません。このまま本番モードにすると管理画面にログインできなくなります。
        </p>

        <div class="accounts-editor__toolbar">
            <UiButton variant="primary" icon="add" @click="openAdd">アカウント追加</UiButton>
            <span class="accounts-editor__count">{{ accounts.length }}件</span>
        </div>

        <DataTable :columns="columns" :rows="accounts" row-key="id" :loading="loading" empty-text="アカウントはありません">
            <template #cell-isAdmin="{ row }">{{ row.isAdmin ? '管理者' : '一般' }}</template>
            <template #cell-hasPassword="{ row }">{{ row.hasPassword ? '設定済み' : '未設定' }}</template>
            <template #cell-actions="{ row }">
                <div class="accounts-editor__row-actions">
                    <UiButton size="sm" icon="edit" icon-only aria-label="編集" @click="openEdit(row)" />
                    <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除"
                        @click="removeOne(row)" />
                </div>
            </template>
        </DataTable>

        <UiDialog v-model="dialogOpen" :title="editing ? 'アカウント編集' : 'アカウント追加'" size="sm" :persistent="saving"
            confirm-label="保存" :loading="saving" :confirm-disabled="!canSave" @confirm="save">
            <form class="accounts-editor__form" @submit.prevent="save">
                <UiField label="ID" :required="!editing">
                    <input v-model="formId" type="text" :disabled="!!editing" autocomplete="off" />
                </UiField>
                <UiField label="名前" required>
                    <input v-model="formName" type="text" autocomplete="off" />
                </UiField>
                <label class="accounts-editor__check">
                    <input v-model="formIsAdmin" type="checkbox" />
                    管理者にする
                </label>
                <UiField :label="editing ? '新しいパスワード' : 'パスワード'"
                    :hint="`${MIN_PASSWORD_LENGTH}文字以上。${editing ? '空欄なら変更しません' : '管理者はログインに必要です'}`"
                    :error="formError">
                    <input v-model="formPassword" type="password" autocomplete="new-password" />
                </UiField>
            </form>
        </UiDialog>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { container } from 'tsyringe';
import { DataTable, UiButton, UiDialog, UiField, toast, useConfirm } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import { AccountsRepository, isProductionMode } from '@octopus/accounts';
import type { Member } from '@octopus/accounts';
import { useAuthSession } from '../../../../control/auth/auth-session';

/** サーバー側 setPassword の最小文字数(accounts-use-cases.ts の MIN_PASSWORD_LENGTH と同じ)。 */
const MIN_PASSWORD_LENGTH = 8;

const repo = container.resolve(AccountsRepository);
const { confirmDelete } = useConfirm();
const { currentMember } = useAuthSession();
const production = isProductionMode();

const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: '名前', sortable: true },
    { key: 'isAdmin', label: '権限' },
    { key: 'hasPassword', label: 'パスワード' },
    { key: 'actions', label: '操作' },
];

const accounts = ref<Member[]>([]);
const loading = ref(false);

const hasLoginableAdmin = computed(() => accounts.value.some((a) => a.isAdmin && a.hasPassword));

async function load() {
    loading.value = true;
    try {
        accounts.value = await repo.listAccounts();
    } catch (e) {
        toast.error(`アカウント一覧の取得に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        loading.value = false;
    }
}

onMounted(load);

const dialogOpen = ref(false);
const editing = ref<Member | null>(null);
const formId = ref('');
const formName = ref('');
const formIsAdmin = ref(false);
const formPassword = ref('');
const formError = ref('');
const saving = ref(false);

const canSave = computed(
    () =>
        !!formName.value.trim() &&
        (!!editing.value || !!formId.value.trim()) &&
        (!formPassword.value || formPassword.value.length >= MIN_PASSWORD_LENGTH),
);

function openAdd() {
    editing.value = null;
    formId.value = '';
    formName.value = '';
    formIsAdmin.value = false;
    formPassword.value = '';
    formError.value = '';
    dialogOpen.value = true;
}

function openEdit(row: Member) {
    editing.value = row;
    formId.value = row.id;
    formName.value = row.name;
    formIsAdmin.value = row.isAdmin === true;
    formPassword.value = '';
    formError.value = '';
    dialogOpen.value = true;
}

async function save() {
    if (!canSave.value || saving.value) return;
    // 自分自身の管理者権限を外すと、本番モードでその場から操作できなくなる
    if (editing.value && editing.value.id === currentMember.value?.id && !formIsAdmin.value) {
        formError.value = 'ログイン中のアカウントの管理者権限は外せません';
        return;
    }
    saving.value = true;
    formError.value = '';
    try {
        const name = formName.value.trim();
        const id = editing.value
            ? (await repo.updateMember({ id: editing.value.id, name, isAdmin: formIsAdmin.value })).id
            : (await repo.addMember({ id: formId.value.trim(), name, isAdmin: formIsAdmin.value })).id;
        // 先に作成/更新して成功してから、パスワードを設定する
        if (formPassword.value) await repo.setPassword(id, formPassword.value);
        dialogOpen.value = false;
        await load();
    } catch (e) {
        formError.value = e instanceof Error ? e.message : String(e);
    } finally {
        saving.value = false;
    }
}

async function removeOne(row: Member) {
    if (row.id === currentMember.value?.id) {
        toast.error('ログイン中のアカウントは削除できません');
        return;
    }
    if (!(await confirmDelete(`「${row.name}」を削除しますか?`))) return;
    try {
        await repo.deleteMember(row.id);
        await load();
    } catch (e) {
        toast.error(`削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
}
</script>

<style scoped>
.accounts-editor__notice,
.accounts-editor__warning {
    margin: 0 0 var(--ui-space-3, 12px);
    font-size: var(--ui-font-sm, 0.875rem);
}

.accounts-editor__notice {
    color: var(--ui-text-muted, #cfd6dd);
}

.accounts-editor__warning {
    color: var(--ui-danger, #e5484d);
}

.accounts-editor__toolbar {
    display: flex;
    align-items: center;
    gap: var(--ui-space-3, 12px);
    margin-bottom: var(--ui-space-3, 12px);
}

.accounts-editor__count {
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.accounts-editor__row-actions {
    display: flex;
    gap: var(--ui-space-2, 8px);
}

.accounts-editor__form {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
}

.accounts-editor__check {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2, 8px);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
