<template>
    <section class="ui-member-editor">
        <div class="ui-member-editor__toolbar">
            <UiButton variant="primary" icon="add" @click="openAdd">追加</UiButton>
            <UiButton v-if="selectedIds.length" variant="danger" icon="delete" :loading="busy" @click="removeSelected">
                選択を削除({{ selectedIds.length }})
            </UiButton>
            <TableIoToolbar :count="members.length" :on-export="onExport" :media-label="photoEnabled ? '写真も含める(ZIP)' : undefined"
                :importable="!!onPreviewImport" @import="importOpen = true" />
        </div>

        <DataTable :columns="columns" :rows="members" row-key="id" selectable v-model:selected="selectedIds"
            :loading="loading" empty-text="メンバーはいません">
            <template #cell-photo="{ row }">
                <img v-if="photoUrls?.[row.photo]" class="ui-member-editor__thumb" :src="photoUrls[row.photo]"
                    :alt="`${row.name}の写真`" data-testid="member-thumb" />
                <span v-else class="ui-member-editor__thumb ui-member-editor__thumb--empty" aria-hidden="true">{{ initialOf(row.name) }}</span>
            </template>
            <template #cell-actions="{ row }">
                <div class="ui-member-editor__row-actions">
                    <UiButton size="sm" icon="edit" icon-only aria-label="編集" @click="openEdit(row)" />
                    <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除" @click="removeOne(row)" />
                </div>
            </template>
        </DataTable>

        <TableImportDialog v-if="onPreviewImport" v-model="importOpen" :on-preview="onPreviewImport" :allow-replace="allowReplace"
            media-label="画像フォルダ" media-hint="CSVの「写真」列のファイル名と同じ画像が入ったフォルダ。ZIPなら不要です" />

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
                <UiField v-if="photoEnabled" label="写真(任意)" hint="長辺512pxに縮小して保存します">
                    <div class="ui-member-editor__photo">
                        <img v-if="dialogPhotoUrl" class="ui-member-editor__thumb ui-member-editor__thumb--lg" :src="dialogPhotoUrl"
                            alt="選んだ写真" data-testid="member-photo-preview" />
                        <span v-else class="ui-member-editor__thumb ui-member-editor__thumb--lg ui-member-editor__thumb--empty"
                            aria-hidden="true">{{ initialOf(formName) }}</span>
                        <div class="ui-member-editor__photo-actions">
                            <input type="file" accept="image/*" :disabled="picking || saving" data-testid="member-photo-input"
                                aria-label="写真を選ぶ" @change="pickPhoto" />
                            <UiButton v-if="dialogPhotoUrl" size="sm" variant="danger" :disabled="picking || saving"
                                data-testid="member-photo-clear" @click="clearPhoto">写真を外す</UiButton>
                            <span v-if="picking" class="ui-member-editor__photo-status">写真を処理しています…</span>
                        </div>
                    </div>
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
import TableImportDialog from '../table-io/table-import-dialog.vue';
import TableIoToolbar from '../table-io/table-io-toolbar.vue';
import type { TableImportInput, TableImportPreview } from '../table-io/types';

export interface MemberRow {
    id: string;
    name: string;
    /** 写真のハッシュ。`photoUrls` で表示用のURLに引く。 */
    photo?: string;
}

/** 選んだ写真を保存し終えたあとの結果。`hash` を名簿に記録し、`url` をすぐ表示に使う。 */
export interface PickedPhoto {
    hash: string;
    url: string;
}

const props = withDefaults(
    defineProps<{
        members: MemberRow[];
        loading?: boolean;
        /** true で追加時にIDの入力を必須にする(クイズのログインID等) */
        idRequired?: boolean;
        /** 追加・更新・削除の完了を待つ。戻り値は使わない。 */
        onAdd: (input: { id?: string; name: string; photo?: string }) => Promise<unknown>;
        /** photo を省略すると既存の写真を保つ。空文字で外す。 */
        onUpdate: (input: MemberRow) => Promise<unknown>;
        onDelete: (ids: string[]) => Promise<unknown>;
        /**
         * 指定すると写真の欄(一覧のサムネイルと、追加・編集の写真選択)を出す。選んだ画像を縮小して保存し、
         * そのハッシュと表示用のURLを返す。失敗は例外で伝える。
         */
        onPickPhoto?: (file: File) => Promise<PickedPhoto>;
        /** 写真のハッシュ → 表示用のURL。一覧のサムネイルに使う。 */
        photoUrls?: Record<string, string>;
        /** 指定すると「CSVダウンロード」を出す(取込と同じ書式。`includeMedia` ならZIPで写真も含める)。失敗は例外で伝える。 */
        onExport?: (options: { includeMedia: boolean }) => Promise<unknown>;
        /** 指定すると「CSVから取り込む」を出す。選んだファイルを読んで、行ごとの結果と確定の処理を返す。 */
        onPreviewImport?: (input: TableImportInput) => Promise<TableImportPreview>;
        /** 真なら取込に「ファイルに無い行を削除する(置き換え)」を出す。共有の名簿のように消してはいけない画面では偽。 */
        allowReplace?: boolean;
    }>(),
    { loading: false, idRequired: false, allowReplace: false },
);

const photoEnabled = computed(() => !!props.onPickPhoto);
const columns = computed<DataTableColumn[]>(() => [
    { key: 'id', label: 'ID', sortable: true },
    ...(photoEnabled.value ? [{ key: 'photo', label: '写真', class: 'ui-member-editor__photo-col' }] : []),
    { key: 'name', label: '名前', sortable: true },
    { key: 'actions', label: '操作', class: 'ui-member-editor__actions-col' },
]);

const initialOf = (name: string): string => Array.from(name.trim())[0] ?? '?';

const importOpen = ref(false);

const { confirmDelete } = useConfirm();
const selectedIds = ref<string[]>([]);
const busy = ref(false);

const dialogOpen = ref(false);
const editing = ref<MemberRow | null>(null);
const formId = ref('');
const formName = ref('');
const formError = ref('');
const saving = ref(false);
/** 写真の入力。undefined=変えない、''=外す、それ以外=選んだ写真のハッシュ。 */
const formPhoto = ref<string | undefined>(undefined);
const pickedUrl = ref<string | undefined>(undefined);
const picking = ref(false);
/** 編集中のメンバーの、いまの写真のURL。 */
const dialogPhotoUrl = computed(() => {
    if (formPhoto.value === '') return undefined;
    if (formPhoto.value !== undefined) return pickedUrl.value;
    const current = editing.value?.photo;
    return current ? props.photoUrls?.[current] : undefined;
});

async function pickPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !props.onPickPhoto) return;
    picking.value = true;
    formError.value = '';
    try {
        const picked = await props.onPickPhoto(file);
        formPhoto.value = picked.hash;
        pickedUrl.value = picked.url;
    } catch (e) {
        formError.value = `写真を保存できませんでした: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
        picking.value = false;
    }
}

function clearPhoto() {
    formPhoto.value = '';
    pickedUrl.value = undefined;
}

const canSave = computed(() => !picking.value && !!formName.value.trim() && (!props.idRequired || !!editing.value || !!formId.value.trim()));

function openAdd() {
    editing.value = null;
    formId.value = '';
    formName.value = '';
    formError.value = '';
    formPhoto.value = undefined;
    pickedUrl.value = undefined;
    dialogOpen.value = true;
}

function openEdit(row: MemberRow) {
    editing.value = row;
    formId.value = row.id;
    formName.value = row.name;
    formError.value = '';
    formPhoto.value = undefined;
    pickedUrl.value = undefined;
    dialogOpen.value = true;
}

async function save() {
    if (!canSave.value || saving.value) return;
    saving.value = true;
    formError.value = '';
    try {
        if (editing.value) await props.onUpdate({ id: editing.value.id, name: formName.value.trim(), photo: formPhoto.value });
        else await props.onAdd({ id: formId.value.trim() || undefined, name: formName.value.trim(), photo: formPhoto.value || undefined });
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



.ui-member-editor__row-actions {
    display: flex;
    gap: var(--ui-space-2, 8px);
}

.ui-member-editor__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    vertical-align: middle;
}

.ui-member-editor__thumb--lg {
    width: 72px;
    height: 72px;
    flex: none;
    font-size: 1.5rem;
}

.ui-member-editor__thumb--empty {
    background: var(--ui-surface-2, #2a3138);
    color: var(--ui-text-muted, #cfd6dd);
    font-weight: 700;
}

.ui-member-editor__photo {
    display: flex;
    align-items: center;
    gap: var(--ui-space-3, 12px);
}

.ui-member-editor__photo-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-2, 8px);
    min-width: 0;
}

.ui-member-editor__photo-status {
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.ui-member-editor__form {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
}
</style>
