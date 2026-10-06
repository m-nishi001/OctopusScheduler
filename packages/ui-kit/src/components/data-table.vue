<template>
    <table class="ui-data-table">
        <thead>
            <tr>
                <th v-for="col in columns" :key="col.key" :class="col.class">{{ col.label }}</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="(row, i) in rows" :key="rowKey ? String(cell(row, rowKey)) : i">
                <td v-for="col in columns" :key="col.key" :data-label="col.label" :class="col.class">
                    <slot :name="`cell-${col.key}`" :row="row" :index="i" :value="cell(row, col.key)">
                        {{ cell(row, col.key) }}
                    </slot>
                </td>
            </tr>
        </tbody>
    </table>
</template>

<script setup lang="ts">
export interface DataTableColumn {
    key: string;
    label: string;
    class?: string;
}

defineProps<{
    columns: DataTableColumn[];
    rows: any[];
    rowKey?: string;
}>();

const cell = (row: Record<string, unknown>, key: string) => row[key];
</script>

<style scoped>
.ui-data-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
}

.ui-data-table th,
.ui-data-table td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid var(--ui-border, #3a4048);
    overflow-wrap: anywhere;
    vertical-align: middle;
}

.ui-data-table th {
    font-size: 0.85rem;
    color: var(--ui-text-muted, #cfd6dd);
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
        padding: 8px 0;
        border-bottom: 1px solid var(--ui-border, #3a4048);
    }

    .ui-data-table td {
        display: flex;
        gap: 12px;
        border-bottom: none;
        padding: 4px 0;
    }

    .ui-data-table td::before {
        content: attr(data-label);
        flex: 0 0 6em;
        color: var(--ui-text-muted, #cfd6dd);
        font-size: 0.85rem;
    }
}
</style>
