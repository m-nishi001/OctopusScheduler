<template>
    <div class="table-section">
        <table class="shortcut-table">
            <thead>
                <tr>
                    <th>キー組み合わせ</th>
                    <th>アクション</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="shortcut in shortcuts" :key="shortcut.id">
                    <td>{{ shortcut.keys.join(' + ') }}</td>
                    <td>{{ shortcut.action.type }}</td>
                    <td>
                        <button class="edit-btn" @click="onEdit(shortcut)">編集</button>
                        <button class="delete-btn" @click="onDelete(shortcut.id)">削除</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup lang="ts">
import { KeyboardShortcut } from '../../../../model/domains/keyboard-shortcut/keyboard-shortcut';

interface Props {
    shortcuts: KeyboardShortcut[];
}

interface Emits {
    edit: [shortcut: KeyboardShortcut];
    delete: [id: string];
}

defineProps<Props>();

const emit = defineEmits<Emits>();

const onEdit = (shortcut: KeyboardShortcut) => {
    emit('edit', shortcut);
};

const onDelete = (id: string) => {
    emit('delete', id);
};
</script>

<style scoped>
.table-section {
    overflow-x: auto;
}

.shortcut-table {
    width: 100%;
    border-collapse: collapse;
}

.shortcut-table th,
.shortcut-table td {
    border: 1px solid #444;
    padding: 8px;
}

.edit-btn,
.delete-btn {
    margin: 0 4px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.edit-btn {
    background: #28a745;
    color: white;
}

.delete-btn {
    background: #dc3545;
    color: white;
}
</style>