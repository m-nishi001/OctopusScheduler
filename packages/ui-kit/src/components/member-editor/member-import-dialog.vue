<template>
    <UiDialog :model-value="modelValue" title="CSVから取り込む" size="lg" :persistent="applying"
        :confirm-label="result ? undefined : '取り込む'" :loading="applying"
        :confirm-disabled="!canApply" @update:model-value="emit('update:modelValue', $event)" @confirm="apply">
        <div class="ui-member-import">
            <template v-if="!result">
                <p class="ui-member-import__lead">
                    CSV(または「写真つき」で書き出したZIP)を選びます。IDが同じメンバーは上書き、無ければ追加します。CSVに無いメンバーは削除しません。
                </p>
                <UiField label="CSV または ZIP" required>
                    <input type="file" accept=".csv,.zip,text/csv,application/zip" :disabled="applying"
                        data-testid="member-import-table" aria-label="CSVまたはZIPを選ぶ" @change="pickTable" />
                </UiField>
                <UiField label="画像フォルダ(任意)" hint="CSVの「写真」列のファイル名と同じ画像が入ったフォルダ。ZIPなら不要です">
                    <input type="file" multiple webkitdirectory :disabled="applying" data-testid="member-import-images"
                        aria-label="画像フォルダを選ぶ" @change="pickImages" />
                </UiField>
                <p v-if="reading" class="ui-member-import__status" data-testid="member-import-reading">読み込んでいます…</p>
                <ul v-if="errors.length" class="ui-member-import__errors" data-testid="member-import-errors">
                    <li v-for="e in errors" :key="e">{{ e }}</li>
                </ul>
                <template v-if="preview">
                    <p class="ui-member-import__counts" data-testid="member-import-counts">
                        追加 {{ preview.counts.add }} / 更新 {{ preview.counts.update }} / 変更なし {{ preview.counts.unchanged }} /
                        エラー {{ preview.counts.error }}
                    </p>
                    <div class="ui-member-import__scroll">
                        <table class="ui-member-import__table">
                            <thead>
                                <tr><th>行</th><th>ID</th><th>名前</th><th>結果</th></tr>
                            </thead>
                            <tbody>
                                <tr v-for="r in preview.rows" :key="r.line" :data-status="r.status" data-testid="member-import-row">
                                    <td>{{ r.line }}</td>
                                    <td>{{ r.id || '(自動)' }}</td>
                                    <td>{{ r.name }}</td>
                                    <td :class="`ui-member-import__badge ui-member-import__badge--${r.status}`">
                                        {{ LABELS[r.status] }}<template v-if="r.message">: {{ r.message }}</template>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p v-if="preview.counts.error" class="ui-member-import__hint">エラーの行は取り込まれません。</p>
                </template>
                <p v-if="progress" class="ui-member-import__status" role="status" data-testid="member-import-progress">{{ progress }}</p>
                <p v-if="applyError" class="ui-member-import__error" role="alert" data-testid="member-import-error">
                    取り込めませんでした: {{ applyError }}(もう一度「取り込む」を押すと、送信済みの写真は飛ばして続きから進みます)
                </p>
            </template>
            <template v-else>
                <p class="ui-member-import__done" role="status" data-testid="member-import-result">{{ result.summary }}</p>
                <ul class="ui-member-import__details" data-testid="member-import-details">
                    <li v-for="d in result.details" :key="d">{{ d }}</li>
                </ul>
            </template>
        </div>
        <template v-if="result" #footer>
            <UiButton variant="primary" data-testid="member-import-close" @click="emit('update:modelValue', false)">閉じる</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import UiButton from '../ui-button/ui-button.vue';
import UiDialog from '../ui-dialog/ui-dialog.vue';
import UiField from '../form-grid/ui-field.vue';
import type { MemberImportInput, MemberImportPreview, MemberImportResult, MemberImportStatus } from './member-import';

const props = defineProps<{
    modelValue: boolean;
    /** 選んだファイルを読み、行ごとの結果(プレビュー)を作る。名簿はまだ書かない。 */
    onPreview: (input: MemberImportInput) => Promise<MemberImportPreview>;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const LABELS: Record<MemberImportStatus, string> = { add: '追加', update: '更新', unchanged: '変更なし', error: 'エラー' };

const table = ref<File | null>(null);
const images = ref<File[]>([]);
const reading = ref(false);
const preview = ref<Extract<MemberImportPreview, { ok: true }> | null>(null);
const errors = ref<string[]>([]);
const applying = ref(false);
const progress = ref('');
const applyError = ref('');
const result = ref<MemberImportResult | null>(null);

const canApply = computed(() => !!preview.value && !reading.value && !applying.value && preview.value.counts.add + preview.value.counts.update > 0);

// 開くたびに空に戻す。
watch(
    () => props.modelValue,
    (open) => {
        if (!open) return;
        table.value = null;
        images.value = [];
        preview.value = null;
        errors.value = [];
        progress.value = '';
        applyError.value = '';
        result.value = null;
    },
);

let readToken = 0;
async function refresh() {
    const token = ++readToken;
    preview.value = null;
    errors.value = [];
    applyError.value = '';
    if (!table.value) return;
    reading.value = true;
    try {
        const next = await props.onPreview({ table: table.value, images: images.value });
        if (token !== readToken) return;
        if (next.ok) preview.value = next;
        else errors.value = next.errors;
    } catch (e) {
        if (token === readToken) errors.value = [e instanceof Error ? e.message : String(e)];
    } finally {
        if (token === readToken) reading.value = false;
    }
}

function pickTable(event: Event) {
    table.value = (event.target as HTMLInputElement).files?.[0] ?? null;
    void refresh();
}

function pickImages(event: Event) {
    images.value = Array.from((event.target as HTMLInputElement).files ?? []);
    void refresh();
}

async function apply() {
    if (!preview.value || !canApply.value) return;
    applying.value = true;
    applyError.value = '';
    try {
        result.value = await preview.value.apply((message) => (progress.value = message));
    } catch (e) {
        applyError.value = e instanceof Error ? e.message : String(e);
    } finally {
        applying.value = false;
        progress.value = '';
    }
}
</script>

<style scoped>
.ui-member-import { display: flex; flex-direction: column; gap: var(--ui-space-3, 12px); min-width: 0; }
.ui-member-import__lead, .ui-member-import__hint { margin: 0; color: var(--ui-text-muted, #cfd6dd); font-size: var(--ui-font-sm, 0.875rem); }
.ui-member-import__status { margin: 0; color: var(--ui-text-muted, #cfd6dd); }
.ui-member-import__counts, .ui-member-import__done { margin: 0; font-weight: 700; }
.ui-member-import__errors, .ui-member-import__error { margin: 0; color: var(--ui-danger, #ff8a80); }
.ui-member-import__details { margin: 0; padding-left: 1.2em; }
.ui-member-import__scroll { max-height: 40vh; overflow: auto; border: 1px solid var(--ui-border, #3a434b); border-radius: 6px; }
.ui-member-import__table { width: 100%; border-collapse: collapse; font-size: var(--ui-font-sm, 0.875rem); }
.ui-member-import__table th, .ui-member-import__table td { padding: 4px 8px; text-align: left; border-bottom: 1px solid var(--ui-border, #3a434b); }
.ui-member-import__badge--add { color: #4ade80; }
.ui-member-import__badge--update { color: #60a5fa; }
.ui-member-import__badge--unchanged { color: var(--ui-text-muted, #cfd6dd); }
.ui-member-import__badge--error { color: var(--ui-danger, #ff8a80); font-weight: 700; }
</style>
