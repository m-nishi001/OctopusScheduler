<template>
    <UiDialog :model-value="modelValue" title="CSVから取り込む" size="lg" :persistent="phase === 'applying'"
        :confirm-label="phase === 'result' ? undefined : '取り込む'" :loading="phase === 'applying'"
        :confirm-disabled="!canApply" @update:model-value="emit('update:modelValue', $event)" @confirm="apply">
        <div class="ui-table-import">
            <template v-if="phase !== 'result'">
                <p class="ui-table-import__lead">
                    CSV(または「素材も含める」で書き出したZIP)を選びます。IDが同じ行は上書き、無ければ追加します。<template v-if="allowReplace">既定ではファイルに無い行は削除しません。</template><template v-else>ファイルに無い行は削除しません。</template>
                </p>
                <UiField label="CSV または ZIP" required>
                    <input type="file" accept=".csv,.zip,text/csv,application/zip" :disabled="busy"
                        data-testid="table-import-table" aria-label="CSVまたはZIPを選ぶ" @change="pickTable" />
                </UiField>
                <UiField :label="`${mediaLabel}(任意)`" :hint="mediaHint">
                    <input type="file" multiple webkitdirectory :disabled="busy" data-testid="table-import-media"
                        :aria-label="`${mediaLabel}を選ぶ`" @change="pickMedia" />
                </UiField>
                <label v-if="allowReplace" class="ui-table-import__replace">
                    <input v-model="replace" type="checkbox" :disabled="busy" data-testid="table-import-replace" />
                    ファイルに無い行を削除する(置き換え)
                </label>
                <p v-if="phase === 'loading'" class="ui-table-import__status" data-testid="table-import-reading">読み込んでいます…</p>
                <ul v-if="errors.length" class="ui-table-import__errors" data-testid="table-import-errors">
                    <li v-for="e in errors" :key="e">{{ e }}</li>
                </ul>
                <template v-if="preview">
                    <p class="ui-table-import__counts" data-testid="table-import-counts">
                        追加 {{ preview.counts.add }} / 更新 {{ preview.counts.update }} / 変更なし {{ preview.counts.unchanged }} /
                        <template v-if="allowReplace">削除 {{ preview.counts.delete }} / </template>エラー {{ preview.counts.error }}
                    </p>
                    <p v-if="preview.media" class="ui-table-import__counts" data-testid="table-import-media-counts">
                        {{ mediaLabelShort }} 追加 {{ preview.media.added }} / 差し替え {{ preview.media.replaced }}
                    </p>
                    <div class="ui-table-import__scroll">
                        <table class="ui-table-import__table">
                            <thead>
                                <tr><th>行</th><th>ID</th><th>名前</th><th>結果</th></tr>
                            </thead>
                            <tbody>
                                <tr v-for="(r, i) in preview.rows" :key="`${r.line}-${r.key}-${i}`" :data-status="r.status" data-testid="table-import-row">
                                    <td>{{ r.line ?? '—' }}</td>
                                    <td>{{ r.key || '(自動)' }}</td>
                                    <td>{{ r.label }}</td>
                                    <td :class="`ui-table-import__badge ui-table-import__badge--${r.status}`">
                                        {{ LABELS[r.status] }}<template v-if="r.message">: {{ r.message }}</template>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p v-if="preview.counts.error" class="ui-table-import__hint" data-testid="table-import-blocked">
                        エラーの行があるため取り込めません。ファイルを直して、もう一度選んでください。
                    </p>
                </template>
                <p v-if="progress" class="ui-table-import__status" role="status" data-testid="table-import-progress">{{ progress }}</p>
                <p v-if="applyError" class="ui-table-import__error" role="alert" data-testid="table-import-error">
                    取り込めませんでした: {{ applyError }}(もう一度「取り込む」を押すと、送信済みの素材は飛ばして続きから進みます)
                </p>
            </template>
            <template v-else-if="result">
                <p class="ui-table-import__done" role="status" data-testid="table-import-result">{{ result.summary }}</p>
                <ul class="ui-table-import__details" data-testid="table-import-details">
                    <li v-for="d in result.details" :key="d">{{ d }}</li>
                </ul>
            </template>
        </div>
        <template v-if="phase === 'result'" #footer>
            <UiButton variant="primary" data-testid="table-import-close" @click="emit('update:modelValue', false)">閉じる</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import UiButton from '../ui-button/ui-button.vue';
import UiDialog from '../ui-dialog/ui-dialog.vue';
import UiField from '../form-grid/ui-field.vue';
import { useConfirm } from '../../composables/use-feedback';
import type { TableImportInput, TableImportPreview, TableImportResult, TableImportStatus } from './types';

type Phase = 'loading' | 'preview' | 'applying' | 'result';

const props = withDefaults(
    defineProps<{
        modelValue: boolean;
        /** 選んだファイルを読み、行ごとの結果(プレビュー)を作る。まだ何も書かない。 */
        onPreview: (input: TableImportInput) => Promise<TableImportPreview>;
        /** 真なら「ファイルに無い行を削除する(置き換え)」のチェックを出す。 */
        allowReplace?: boolean;
        /** 素材のフォルダ欄の呼び名(例: 画像)。 */
        mediaLabel?: string;
        mediaHint?: string;
    }>(),
    { allowReplace: false, mediaLabel: '素材フォルダ', mediaHint: 'CSVの素材の列のファイル名と同じファイルが入ったフォルダ。ZIPなら不要です' },
);
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const LABELS: Record<TableImportStatus, string> = { add: '追加', update: '更新', unchanged: '変更なし', delete: '削除', error: 'エラー' };
const mediaLabelShort = computed(() => props.mediaLabel.replace(/フォルダ$/, ''));

const { confirmDelete } = useConfirm();
const table = ref<File | null>(null);
const media = ref<File[]>([]);
const replace = ref(false);
const phase = ref<Phase>('preview');
const preview = ref<Extract<TableImportPreview, { ok: true }> | null>(null);
const errors = ref<string[]>([]);
const progress = ref('');
const applyError = ref('');
const result = ref<TableImportResult | null>(null);

const busy = computed(() => phase.value === 'loading' || phase.value === 'applying');
/** エラーの行が1つでもあれば取り込めない。 */
const canApply = computed(() => {
    const p = preview.value;
    if (!p || busy.value || p.counts.error > 0) return false;
    return p.counts.add + p.counts.update + p.counts.delete > 0;
});

// 開くたびに空に戻す。
watch(
    () => props.modelValue,
    (open) => {
        if (!open) return;
        table.value = null;
        media.value = [];
        replace.value = false;
        preview.value = null;
        errors.value = [];
        progress.value = '';
        applyError.value = '';
        result.value = null;
        phase.value = 'preview';
    },
);

let readToken = 0;
async function refresh() {
    const token = ++readToken;
    preview.value = null;
    errors.value = [];
    applyError.value = '';
    phase.value = 'preview';
    if (!table.value) return;
    phase.value = 'loading';
    try {
        const next = await props.onPreview({ table: table.value, media: media.value, mode: props.allowReplace && replace.value ? 'replace' : 'upsert' });
        if (token !== readToken) return;
        if (next.ok) preview.value = next;
        else errors.value = next.errors;
    } catch (e) {
        if (token === readToken) errors.value = [e instanceof Error ? e.message : String(e)];
    } finally {
        if (token === readToken) phase.value = 'preview';
    }
}

function pickTable(event: Event) {
    table.value = (event.target as HTMLInputElement).files?.[0] ?? null;
    void refresh();
}

function pickMedia(event: Event) {
    media.value = Array.from((event.target as HTMLInputElement).files ?? []);
    void refresh();
}

watch(replace, () => void refresh());

async function apply() {
    const p = preview.value;
    if (!p || !canApply.value) return;
    if (p.counts.delete > 0 && !(await confirmDelete(`ファイルに無い${p.counts.delete}件を削除します。よろしいですか?`))) return;
    phase.value = 'applying';
    applyError.value = '';
    try {
        result.value = await p.apply((message) => (progress.value = message));
        phase.value = 'result';
    } catch (e) {
        applyError.value = e instanceof Error ? e.message : String(e);
        phase.value = 'preview';
    } finally {
        progress.value = '';
    }
}
</script>

<style scoped>
.ui-table-import { display: flex; flex-direction: column; gap: var(--ui-space-3, 12px); min-width: 0; }
.ui-table-import__lead, .ui-table-import__hint { margin: 0; color: var(--ui-text-muted, #cfd6dd); font-size: var(--ui-font-sm, 0.875rem); }
.ui-table-import__status { margin: 0; color: var(--ui-text-muted, #cfd6dd); }
.ui-table-import__replace { display: inline-flex; align-items: center; gap: var(--ui-space-1, 4px); font-size: var(--ui-font-sm, 0.875rem); }
.ui-table-import__counts, .ui-table-import__done { margin: 0; font-weight: 700; }
.ui-table-import__errors, .ui-table-import__error { margin: 0; color: var(--ui-danger, #ff8a80); }
.ui-table-import__details { margin: 0; padding-left: 1.2em; }
.ui-table-import__scroll { max-height: 40vh; overflow: auto; border: 1px solid var(--ui-border, #3a434b); border-radius: 6px; }
.ui-table-import__table { width: 100%; border-collapse: collapse; font-size: var(--ui-font-sm, 0.875rem); }
.ui-table-import__table th, .ui-table-import__table td { padding: 4px 8px; text-align: left; border-bottom: 1px solid var(--ui-border, #3a434b); }
.ui-table-import__badge--add { color: #4ade80; }
.ui-table-import__badge--update { color: #60a5fa; }
.ui-table-import__badge--unchanged { color: var(--ui-text-muted, #cfd6dd); }
.ui-table-import__badge--delete { color: #fbbf24; font-weight: 700; }
.ui-table-import__badge--error { color: var(--ui-danger, #ff8a80); font-weight: 700; }
</style>
