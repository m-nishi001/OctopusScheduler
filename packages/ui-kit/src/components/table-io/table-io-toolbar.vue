<template>
    <div class="ui-table-io-toolbar">
        <UiButton v-if="onExport" icon="download" :loading="exporting" data-testid="table-export" @click="exportCsv">CSVダウンロード</UiButton>
        <label v-if="onExport && mediaLabel" class="ui-table-io-toolbar__option">
            <input v-model="includeMedia" type="checkbox" data-testid="table-export-media" />
            {{ mediaLabel }}
        </label>
        <UiButton v-if="importable" icon="upload" data-testid="table-import-open" @click="emit('import')">CSVから取り込む</UiButton>
        <span class="ui-table-io-toolbar__count" data-testid="table-count">{{ count }}件</span>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import UiButton from '../ui-button/ui-button.vue';
import { toast } from '../../composables/use-feedback';

/**
 * 各画面のツールバーの末尾に置く「CSVダウンロード / [ ]素材も含める(ZIP) / CSVから取り込む / n件」。
 * 画面のツールバーは「追加 / 選択を削除(n) / これ」の順に揃える。
 */
const props = withDefaults(
    defineProps<{
        count: number;
        /** 指定すると「CSVダウンロード」を出す。`includeMedia` が真なら ZIP で素材も含める。失敗は例外で伝える。 */
        onExport?: (options: { includeMedia: boolean }) => Promise<unknown>;
        /** 指定すると「素材も含める(ZIP)」のチェックを出す(例: 「写真も含める(ZIP)」)。 */
        mediaLabel?: string;
        /** 「CSVから取り込む」を出すか。 */
        importable?: boolean;
    }>(),
    { importable: true },
);
const emit = defineEmits<{ import: [] }>();

const includeMedia = ref(false);
const exporting = ref(false);

async function exportCsv() {
    if (!props.onExport || exporting.value) return;
    exporting.value = true;
    try {
        await props.onExport({ includeMedia: !!props.mediaLabel && includeMedia.value });
    } catch (e) {
        toast.error(`書き出しに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        exporting.value = false;
    }
}
</script>

<style scoped>
.ui-table-io-toolbar {
    display: contents;
}

.ui-table-io-toolbar__option {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-1, 4px);
    font-size: var(--ui-font-sm, 0.875rem);
}

.ui-table-io-toolbar__count {
    margin-left: auto;
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
