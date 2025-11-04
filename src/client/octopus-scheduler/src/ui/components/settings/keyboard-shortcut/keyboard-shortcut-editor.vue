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
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import KeyboardShortcutList from './keyboard-shortcut-list.vue';
import KeyboardShortcutDialog from './keyboard-shortcut-dialog.vue';
import { KeyboardShortcut } from '../../../../model/domains/keyboard-shortcut/keyboard-shortcut';
import { useKeyboardShortcut } from './composables/useKeyboardShortcut';

const { shortcuts, isEnabled, loadShortcuts, loadConfig, onToggleEnabled, onDelete, saveShortcut } = useKeyboardShortcut();

// ダイアログ関連
const showDialog = ref(false);
const editingShortcut = ref<KeyboardShortcut | null>(null);

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
</style>