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
                    <td>
                        <ul class="action-list">
                            <li v-for="(a, i) in shortcut.actions" :key="actionKey(a, i)">{{ a.type }}</li>
                        </ul>
                    </td>
                    <td>
                        <button class="run-btn" :disabled="isRunningById[shortcut.id]" @click="onRun(shortcut)" aria-label="ショートカットを実行">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
                            </svg>
                        </button>
                        <button class="edit-btn" @click="onEdit(shortcut)">編集</button>
                        <button class="delete-btn" @click="onDelete(shortcut.id)">削除</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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

// running state map to prevent double execution
const isRunningById = ref<Record<string, boolean>>({});

const onRun = async (shortcut: KeyboardShortcut) => {
    if (!shortcut || !shortcut.id) return;
    if (isRunningById.value[shortcut.id]) return;
    try {
        isRunningById.value = { ...isRunningById.value, [shortcut.id]: true };
        // execute the shortcut directly (manual trigger)
        await shortcut.execute();
    } catch (e) {
        // intentionally swallow errors; no toast required
        // console.error('[Shortcut run] error', e);
    } finally {
        isRunningById.value = { ...isRunningById.value, [shortcut.id]: false };
    }
};

// compute stable key for action entries in the saved shortcut list
const actionKey = (a: any, i: number) => {
    return a?.eventId ?? a?.id ?? `act-${i}-${a?.type ?? 'x'}`;
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

.run-btn {
    margin: 0 6px 0 0;
    padding: 6px 8px;
    border: none;
    border-radius: 4px;
    background: #28a745;
    color: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background-color .12s ease, transform .06s ease, box-shadow .12s ease;
}

.run-btn svg,
.run-btn svg path {
    fill: currentColor;
}

.run-btn:hover:not(:disabled) {
    background: #218838;
    transform: translateY(-1px);
}

.run-btn:active:not(:disabled) {
    background: #1e7e34;
    transform: translateY(0);
}

.run-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(40,167,69,0.16);
    border-radius: 4px;
}

.run-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    filter: grayscale(20%);
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