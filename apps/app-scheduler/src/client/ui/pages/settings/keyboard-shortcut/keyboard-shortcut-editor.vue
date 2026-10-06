<template>
    <div class="keyboard-shortcut-editor">
        <UiToolbar>
            <UiButton variant="primary" icon="add" @click="onAdd">追加</UiButton>
            <label class="enable-toggle ui-toolbar__spacer">
                <input type="checkbox" v-model="isEnabled" @change="onToggleEnabled" />
                キーボードショートカットを有効にする
            </label>
        </UiToolbar>
        <KeyboardShortcutList :shortcuts="shortcuts" @edit="onEdit" @delete="onDelete" />
        <KeyboardShortcutDialog :show="showDialog" :editing-shortcut="editingShortcut" @close="closeDialog"
            @save="onSaveShortcut" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { UiButton, UiToolbar } from '@octopus/ui-kit';
import KeyboardShortcutList from './keyboard-shortcut-list.vue';
import KeyboardShortcutDialog from './keyboard-shortcut-dialog.vue';
import { KeyboardShortcut } from '@model/keyboard-shortcut/keyboard-shortcut';
import { useKeyboardShortcut } from './composables/useKeyboardShortcut';

const { shortcuts, isEnabled, loadShortcuts, loadConfig, onToggleEnabled, onDelete, saveShortcut, updateShortcut } = useKeyboardShortcut();

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
        // update in-place without showing delete confirmation
        await updateShortcut(shortcut);
    } else {
        await saveShortcut(shortcut);
    }
    closeDialog();
};

// 手動同期は廃止。バックグラウンド自動同期(useBackgroundSync)に統一された。
</script>

<style scoped>
.enable-toggle {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2, 8px);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
