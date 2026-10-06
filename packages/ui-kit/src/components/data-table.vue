<template>
    <div class="ui-data-table-wrap" :aria-busy="loading || undefined">
        <table class="ui-data-table">
            <thead>
                <tr>
                    <th v-if="selectable" class="ui-data-table__check">
                        <input type="checkbox" aria-label="すべて選択" :checked="allSelected"
                            :disabled="!rows.length" @change="toggleAll" />
                    </th>
                    <th v-for="col in columns" :key="col.key" :class="col.class"
                        :aria-sort="ariaSort(col)">
                        <button v-if="col.sortable" type="button" class="ui-data-table__sort" @click="toggleSort(col.key)">
                            {{ col.label }}<span class="ui-data-table__arrow">{{ sortMark(col.key) }}</span>
                        </button>
                        <template v-else>{{ col.label }}</template>
                    </th>
                </tr>
            </thead>
            <tbody>
                <template v-if="loading && !rows.length">
                    <tr v-for="n in 3" :key="`sk-${n}`" class="ui-data-table__skeleton" aria-hidden="true">
                        <td :colspan="colCount"><span class="ui-data-table__bar" /></td>
                    </tr>
                </template>
                <tr v-else-if="!rows.length" class="ui-data-table__empty">
                    <td :colspan="colCount"><slot name="empty">{{ emptyText }}</slot></td>
                </tr>
                <tr v-for="(row, i) in sortedRows" :key="keyOf(row, i)">
                    <td v-if="selectable" class="ui-data-table__check">
                        <input type="checkbox" aria-label="選択" :checked="isSelected(row)" @change="toggleRow(row)" />
                    </td>
                    <td v-for="col in columns" :key="col.key" :data-label="col.label" :class="col.class">
                        <slot :name="`cell-${col.key}`" :row="row" :index="i" :value="cell(row, col.key)">
                            {{ cell(row, col.key) }}
                        </slot>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

export interface DataTableColumn {
    key: string;
    label: string;
    class?: string;
    /** true でヘッダークリックによる昇順/降順ソートを有効にする */
    sortable?: boolean;
}

const props = withDefaults(
    defineProps<{
        columns: DataTableColumn[];
        rows: any[];
        rowKey?: string;
        loading?: boolean;
        emptyText?: string;
        /** 行チェックボックスを表示する(rowKey 必須) */
        selectable?: boolean;
        selected?: string[];
    }>(),
    { emptyText: 'データがありません', selected: () => [] },
);

const emit = defineEmits<{ 'update:selected': [keys: string[]] }>();

const sortKey = ref('');
const sortDir = ref<'asc' | 'desc'>('asc');

const cell = (row: Record<string, unknown>, key: string) => row[key];
const keyOf = (row: Record<string, unknown>, i: number) => (props.rowKey ? String(cell(row, props.rowKey)) : i);
const colCount = computed(() => props.columns.length + (props.selectable ? 1 : 0));

const sortedRows = computed(() => {
    if (!sortKey.value) return props.rows;
    const dir = sortDir.value === 'asc' ? 1 : -1;
    const key = sortKey.value;
    return [...props.rows].sort((a, b) => {
        const x = a[key];
        const y = b[key];
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x ?? '').localeCompare(String(y ?? ''), 'ja', { numeric: true }) * dir;
    });
});

function toggleSort(key: string) {
    if (sortKey.value !== key) {
        sortKey.value = key;
        sortDir.value = 'asc';
    } else if (sortDir.value === 'asc') {
        sortDir.value = 'desc';
    } else {
        sortKey.value = '';
    }
}
const sortMark = (key: string) => (sortKey.value !== key ? '' : sortDir.value === 'asc' ? ' ▲' : ' ▼');
const ariaSort = (col: DataTableColumn) =>
    !col.sortable ? undefined : sortKey.value !== col.key ? 'none' : sortDir.value === 'asc' ? 'ascending' : 'descending';

const rowIds = computed(() => (props.rowKey ? props.rows.map((r) => String(r[props.rowKey!])) : []));
const allSelected = computed(() => rowIds.value.length > 0 && rowIds.value.every((id) => props.selected.includes(id)));
const isSelected = (row: Record<string, unknown>) => !!props.rowKey && props.selected.includes(String(row[props.rowKey]));

function toggleRow(row: Record<string, unknown>) {
    if (!props.rowKey) return;
    const id = String(row[props.rowKey]);
    emit('update:selected', props.selected.includes(id) ? props.selected.filter((s) => s !== id) : [...props.selected, id]);
}
function toggleAll() {
    emit('update:selected', allSelected.value ? [] : [...rowIds.value]);
}
</script>

<style scoped>
.ui-data-table-wrap {
    min-width: 0;
    overflow-x: hidden;
}

.ui-data-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    font-size: var(--ui-font-sm, 0.875rem);
}

.ui-data-table th,
.ui-data-table td {
    padding: var(--ui-space-2, 8px) 10px;
    text-align: left;
    border-bottom: 1px solid var(--ui-border, #3a4048);
    overflow-wrap: anywhere;
    vertical-align: middle;
}

.ui-data-table th {
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #cfd6dd);
}

.ui-data-table__check {
    width: 2.5rem;
}

.ui-data-table__sort {
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
}

.ui-data-table__arrow {
    font-size: var(--ui-font-xs, 0.75rem);
}

.ui-data-table__empty td {
    text-align: center;
    color: var(--ui-text-muted, #cfd6dd);
    padding: var(--ui-space-5, 24px) 0;
}

.ui-data-table__bar {
    display: block;
    height: 1em;
    border-radius: var(--ui-radius, 6px);
    background: var(--ui-border, #3a4048);
    animation: ui-data-table-pulse 1.2s ease-in-out infinite;
}

@keyframes ui-data-table-pulse {
    50% {
        opacity: 0.4;
    }
}

@media (max-width: 640px) {
    .ui-data-table,
    .ui-data-table tbody,
    .ui-data-table tr,
    .ui-data-table td {
        display: block;
        width: 100%;
    }

    .ui-data-table thead {
        display: none;
    }

    .ui-data-table tr {
        padding: var(--ui-space-2, 8px) 0;
        border-bottom: 1px solid var(--ui-border, #3a4048);
    }

    .ui-data-table td {
        display: flex;
        align-items: center;
        gap: var(--ui-space-3, 12px);
        border-bottom: none;
        padding: var(--ui-space-1, 4px) 0;
    }

    .ui-data-table td::before {
        content: attr(data-label);
        flex: 0 0 6em;
        color: var(--ui-text-muted, #cfd6dd);
        font-size: var(--ui-font-sm, 0.875rem);
    }

    .ui-data-table td.ui-data-table__check::before,
    .ui-data-table__empty td::before,
    .ui-data-table__skeleton td::before {
        content: none;
    }

    .ui-data-table__empty td {
        justify-content: center;
    }
}
</style>
