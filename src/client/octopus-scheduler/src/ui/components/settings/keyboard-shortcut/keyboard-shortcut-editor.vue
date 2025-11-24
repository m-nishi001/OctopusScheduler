<template>
    <div class="keyboard-shortcut-editor">
        <h2 class="editor-title">
            <span class="editor-icon">⌨️</span> キーボードショートカット設定
        </h2>
        <div class="config-section">
            <label class="config-label">
                <input type="checkbox" v-model="isEnabled" @change="onToggleEnabled" />
                キーボードショートカットを有効にする
            </label>
        </div>
        <div class="controls">
            <button class="main-btn" @click="onAdd">
                <span class="btn-icon">➕</span> 追加
            </button>
        </div>
        <KeyboardShortcutList :shortcuts="shortcuts" @edit="onEdit" @delete="onDelete" />
        <KeyboardShortcutDialog :show="showDialog" :editing-shortcut="editingShortcut" @close="closeDialog"
            @save="onSaveShortcut" />
        <!-- per-screen sync removed: use 一括同期 (Bulk Sync) in header -->
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import KeyboardShortcutList from './keyboard-shortcut-list.vue';
import KeyboardShortcutDialog from './keyboard-shortcut-dialog.vue';
import { KeyboardShortcut } from '../../../../model/domains/keyboard-shortcut/keyboard-shortcut';
import { useKeyboardShortcut } from './composables/useKeyboardShortcut';

const { shortcuts, isEnabled, loadShortcuts, loadConfig, onToggleEnabled, onDelete, saveShortcut, syncWithServer } = useKeyboardShortcut();

// ダイアログ関連
const showDialog = ref(false);
const editingShortcut = ref<KeyboardShortcut | null>(null);

// per-screen sync removed: use BulkSyncDialog from header

onMounted(async () => {
    await loadShortcuts();
    await loadConfig();
});

const onAdd = () => {
    editingShortcut.value = null;
    showDialog.value = true;
};

const onEdit = (shortcut: KeyboardShortcut) => {
    editingShortcut.value = shortcut;
    showDialog.value = true;
};

const closeDialog = () => {
    showDialog.value = false;
};

const onSaveShortcut = async (shortcut: KeyboardShortcut) => {
    if (editingShortcut.value) {
        await onDelete(editingShortcut.value.id);
    }
    await saveShortcut(shortcut);
};

// per-screen sync removed: syncWithServer remains available for bulk orchestration if needed
</script>

<style scoped>
.keyboard-shortcut-editor {
    color: #fff;
}

.editor-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
}

.config-section {
    margin-bottom: 20px;
}

.config-label {
    display: flex;
    align-items: center;
    gap: 8px;
}

.controls {
    margin-bottom: 20px;
}

.main-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
}

.sync-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin-left: 10px;
}

.sync-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
}

.sync-dialog {
    background: #333;
    color: #fff;
    padding: 20px;
    border-radius: 8px;
    width: 300px;
}

.sync-dialog h3 {
    margin-top: 0;
}

.sync-dialog label {
    display: block;
    margin: 10px 0;
}

.dialog-buttons {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
}

.dialog-buttons button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.dialog-buttons button:first-child {
    background: #007bff;
    color: white;
}

.dialog-buttons button:last-child {
    background: #6c757d;
    color: white;
}
</style>