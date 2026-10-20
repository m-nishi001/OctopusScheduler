<template>
    <section class="accounts-editor">
        <p v-if="!hasLoginableAdmin" class="accounts-editor__warning" role="alert">
            パスワード設定済みの管理者がいません。この状態で全員がログアウトすると、管理画面にログインできなくなります。
        </p>

        <p v-if="capacity" class="accounts-editor__capacity" :class="`is-${capacity.level}`"
            :role="capacity.level === 'ok' ? undefined : 'alert'" data-testid="roster-capacity">
            {{ capacity.message }}
        </p>

        <div class="accounts-editor__toolbar">
            <UiButton variant="primary" icon="add" @click="openAdd">アカウント追加</UiButton>
            <UiButton :disabled="issuing || withoutKey.length === 0" :loading="issuing" @click="issueMissing">
                未発行の参加者に受付QRを発行({{ withoutKey.length }}人)
            </UiButton>
            <span class="accounts-editor__count">{{ accounts.length }}件</span>
        </div>

        <DataTable :columns="columns" :rows="accounts" row-key="id" :loading="loading" empty-text="アカウントはありません">
            <template #cell-isAdmin="{ row }">{{ row.isAdmin ? '管理者' : '一般' }}</template>
            <template #cell-hasPassword="{ row }">{{ row.hasPassword ? '設定済み' : '未設定' }}</template>
            <template #cell-hasLoginKey="{ row }">
                <template v-if="row.isAdmin">—</template>
                <template v-else>{{ row.hasLoginKey ? '発行済み' : '未発行' }}</template>
            </template>
            <template #cell-actions="{ row }">
                <div class="accounts-editor__row-actions">
                    <UiButton v-if="!row.isAdmin" size="sm" :disabled="issuing"
                        :aria-label="`${row.name} の受付QRを${row.hasLoginKey ? '再発行' : '発行'}`" @click="issueOne(row)">
                        {{ row.hasLoginKey ? 'QR再発行' : 'QR発行' }}
                    </UiButton>
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

        <LoginQrSheet v-model="sheetOpen" :cards="sheetCards" />
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { container } from 'tsyringe';
import { DataTable, UiButton, UiDialog, UiField, toast, useConfirm } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import { AccountsRepository } from '@octopus/accounts';
import type { Member, RosterUsage } from '@octopus/accounts';
import { SessionAdminRepository, buildLoginUrl } from '@octopus/session-hub';
import { useAuthSession } from '../../../../control/auth/auth-session';
import LoginQrSheet from './login-qr-sheet.vue';
import type { LoginQrCard } from './login-qr-sheet.vue';
import { qrDataUrl } from './login-qr';
import { describeRosterCapacity } from './roster-capacity';

/** サーバー側 setPassword の最小文字数(accounts-use-cases.ts の MIN_PASSWORD_LENGTH と同じ)。 */
const MIN_PASSWORD_LENGTH = 8;

const repo = container.resolve(AccountsRepository);
const { confirm, confirmDelete } = useConfirm();
const { currentMember } = useAuthSession();

const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: '名前', sortable: true },
    { key: 'isAdmin', label: '権限' },
    { key: 'hasPassword', label: 'パスワード' },
    { key: 'hasLoginKey', label: '受付QR' },
    { key: 'actions', label: '操作' },
];

const accounts = ref<Member[]>([]);
const loading = ref(false);

const hasLoginableAdmin = computed(() => accounts.value.some((a) => a.isAdmin && a.hasPassword));

/** 名簿の容量の使用状況(上限のある保存先でだけ表示する)。取得に失敗しても一覧の表示は止めない。 */
const usage = ref<RosterUsage | null>(null);
const capacity = computed(() => (usage.value ? describeRosterCapacity(usage.value) : null));

async function load() {
    loading.value = true;
    try {
        accounts.value = await repo.listAccounts();
        usage.value = await repo.getRosterUsage().catch(() => null);
    } catch (e) {
        toast.error(`アカウント一覧の取得に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        loading.value = false;
    }
}

onMounted(load);

// 受付QR(参加者ごとのログインキー)。平文のキーは発行直後の1回しか見られないため、
// シートを開いている間だけ画面に保持し、閉じたら破棄する。
const sessionAdmin = container.resolve(SessionAdminRepository);
const issuing = ref(false);
const sheetOpen = ref(false);
const sheetCards = ref<LoginQrCard[]>([]);
const withoutKey = computed(() => accounts.value.filter((a) => !a.isAdmin && !a.hasLoginKey));

watch(sheetOpen, (open) => {
    if (!open) sheetCards.value = [];
});

/** 順番に(1人ずつ)発行する。途中で失敗しても、そこまでに発行できた分はシートに出す。 */
async function issueFor(rows: Member[]) {
    if (issuing.value || rows.length === 0) return;
    issuing.value = true;
    const cards: LoginQrCard[] = [];
    try {
        const base = await sessionAdmin.appBaseUrl();
        for (const row of rows) {
            const key = await repo.issueLoginKey(row.id);
            cards.push({ id: row.id, name: row.name, qr: qrDataUrl(buildLoginUrl(row.id, key, base)) });
        }
    } catch (e) {
        toast.error(`受付QRの発行に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        issuing.value = false;
    }
    if (cards.length > 0) {
        sheetCards.value = cards;
        sheetOpen.value = true;
    }
    await load();
}

async function issueOne(row: Member) {
    if (row.hasLoginKey) {
        const ok = await confirm({
            title: '受付QRの再発行',
            message: `「${row.name}」のQRコードを再発行します。すでに配布したQRコードは使えなくなります。`,
            confirmLabel: '再発行',
            danger: true,
        });
        if (!ok) return;
    }
    await issueFor([row]);
}

async function issueMissing() {
    await issueFor(withoutKey.value);
}

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
    // 自分自身の管理者権限を外すと、その場から操作できなくなる
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
.accounts-editor__warning {
    margin: 0 0 var(--ui-space-3, 12px);
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-danger, #e5484d);
}

.accounts-editor__capacity {
    margin: 0 0 var(--ui-space-3, 12px);
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #6b7280);
}

.accounts-editor__capacity.is-warn {
    color: var(--ui-warning, #b45309);
}

.accounts-editor__capacity.is-full {
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
