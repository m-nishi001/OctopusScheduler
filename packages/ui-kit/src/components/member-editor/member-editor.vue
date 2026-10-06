<template>
    <section class="ui-member-editor">
        <div class="ui-member-editor__toolbar">
            <UiButton variant="primary" icon="add" @click="openAdd">追加</UiButton>
            <UiButton v-if="selectedIds.length" variant="danger" icon="delete" :loading="busy" @click="removeSelected">
                選択を削除({{ selectedIds.length }})
            </UiButton>
            <span class="ui-member-editor__count">{{ members.length }}件</span>
        </div>

        <DataTable :columns="columns" :rows="members" row-key="id" selectable v-model:selected="selectedIds"
            :loading="loading" empty-text="メンバーはいません">
            <template #cell-actions="{ row }">
                <div class="ui-member-editor__row-actions">
                    <UiButton size="sm" icon="edit" icon-only aria-label="編集" @click="openEdit(row)" />
                    <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除" @click="removeOne(row)" />
                </div>
            </template>
        </DataTable>

        <UiDialog v-model="dialogOpen" :title="editing ? 'メンバー編集' : 'メンバー追加'" size="sm" :persistent="saving"
            confirm-label="保存" :loading="saving" :confirm-disabled="!canSave" @confirm="save">
            <form class="ui-member-editor__form" @submit.prevent="save">
                <UiField :label="idRequired ? 'ID' : 'ID(任意)'" :required="idRequired && !editing"
                    :hint="editing || idRequired ? undefined : '未入力の場合は自動採番されます'">
                    <input v-model="formId" type="text" :disabled="!!editing" autocomplete="off" />
                </UiField>
                <UiField label="名前" required :error="formError">
                    <input v-model="formName" type="text" autocomplete="off" />
                </UiField>
            </form>
        </UiDialog>
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DataTable, { type DataTableColumn } from '../data-table.vue';
import UiButton from '../ui-button/ui-button.vue';
import UiDialog from '../ui-dialog/ui-dialog.vue';
import UiField from '../form-grid/ui-field.vue';
import { toast, useConfirm } from '../../composables/use-feedback';

export interface MemberRow {
    id: string;
    name: string;
}

const props = withDefaults(
    defineProps<{
        members: MemberRow[];
        loading?: boolean;
        /** true で追加時にIDの入力を必須にする(クイズのログインID等) */
        idRequired?: boolean;
        onAdd: (input: { id?: string; name: string }) => Promise<void>;
        onUpdate: (input: MemberRow) => Promise<void>;
        onDelete: (ids: string[]) => Promise<void>;
    }>(),
    { loading: false, idRequired: false },
);

const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: '名前', sortable: true },
    { key: 'actions', label: '操作', class: 'ui-member-editor__actions-col' },
];

const { confirmDelete } = useConfirm();
const selectedIds = ref<string[]>([]);
const busy = ref(false);

const dialogOpen = ref(false);
const editing = ref<MemberRow | null>(null);
const formId = ref('');
const formName = ref('');
const formError = ref('');
const saving = ref(false);

const canSave = computed(() => !!formName.value.trim() && (!props.idRequired || !!editing.value || !!formId.value.trim()));

function openAdd() {
    editing.value = null;
    formId.value = '';
    formName.value = '';
    formError.value = '';
    dialogOpen.value = true;
}

function openEdit(row: MemberRow) {
    editing.value = row;
    formId.value = row.id;
    formName.value = row.name;
    formError.value = '';
    dialogOpen.value = true;
}

async function save() {
    if (!canSave.value || saving.value) return;
    saving.value = true;
    formError.value = '';
    try {
        if (editing.value) await props.onUpdate({ id: editing.value.id, name: formName.value.trim() });
        else await props.onAdd({ id: formId.value.trim() || undefined, name: formName.value.trim() });
        dialogOpen.value = false;
    } catch (e) {
        formError.value = e instanceof Error ? e.message : String(e);
    } finally {
        saving.value = false;
    }
}

async function remove(ids: string[], message: string) {
    if (!(await confirmDelete(message))) return;
    busy.value = true;
    try {
        await props.onDelete(ids);
        selectedIds.value = selectedIds.value.filter((id) => !ids.includes(id));
    } catch (e) {
        toast.error(`削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        busy.value = false;
    }
}

const removeOne = (row: MemberRow) => remove([row.id], `「${row.name}」を削除しますか?`);
const removeSelected = () => remove([...selectedIds.value], `選択した${selectedIds.value.length}件を削除しますか?`);
</script>

<style scoped>
.ui-member-editor {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
    min-width: 0;
}

.ui-member-editor__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ui-space-2, 8px);
}

.ui-member-editor__count {
    margin-left: auto;
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.ui-member-editor__row-actions {
    display: flex;
    gap: var(--ui-space-2, 8px);
}

.ui-member-editor__form {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
}
</style>
