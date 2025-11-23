<template>
    <div v-if="show" class="dialog-overlay" @click="closeDialog">
        <div class="dialog" @click.stop>
            <h3>{{ editingShortcut ? '編集' : '追加' }} キーボードショートカット</h3>
            <div class="form-group">
                <label>キー組み合わせ:</label>
                <div class="key-input-section">
                    <input readonly class="captured-keys"
                        :value="capturedKeys.length > 0 ? capturedKeys.join(' + ') : ''"
                        placeholder="ここをクリックしてキーボードショートカットを入力してください" @focus="startKeyCapture" @blur="stopKeyCapture" />

                    <div class="button-group">
                        <button @click="clearKeys" class="clear-btn">クリア</button>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>アクション一覧:</label>
                <div class="actions-list">
                    <action-item-summary v-for="(action, idx) in actions" :key="idx" :action="action" :index="idx"
                        :length="actions.length" @edit="openActionManager" @move-up="moveUp" @move-down="moveDown"
                        @remove="removeAction" />
                </div>
                <div class="add-action">
                    <button @click="addAction">アクションを追加</button>
                </div>
            </div>

            <!-- Dialog area: mounted only when dialogOpen is true -->
            <div v-if="dialogOpen" class="dialog-content">
                <event-selection-dialog v-if="!dialogInitialData" :show="true" @select-type="onTypeSelected"
                    @cancel="onDialogCancel" />

                <component v-else :is="getFormComponent(dialogInitialData.actionType)" :initialData="dialogInitialData"
                    :key="dialogKey" @save="onEditorSave" @cancel="onDialogCancel" ref="currentEditor" />
            </div>
            <div class="dialog-buttons">
                <button @click="saveShortcut" class="save-btn">保存</button>
                <button @click="closeDialog" class="cancel-btn">キャンセル</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue';
import { KeyboardShortcut } from '../../../../model/domains/keyboard-shortcut/keyboard-shortcut';
import { useKeyCapture } from './composables/useKeyCapture';
import { getUIActionRegistry } from './action-registry';
import ActionItemSummary from './action-item-summary.vue';
import EventSelectionDialog from './event-selection-dialog.vue';
import type { EventFormData } from './types';

interface Props {
    show: boolean;
    editingShortcut: KeyboardShortcut | null;
}

interface Emits {
    close: [];
    save: [shortcut: KeyboardShortcut];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { capturedKeys, startKeyCapture, stopKeyCapture, clearKeys } = useKeyCapture();

const actions = ref<Array<EventFormData>>([]);
const formRefs: Record<number, any> = {};
// Minimal dialog state: parent holds only an open flag and a short-lived initial DTO
const dialogOpen = ref(false);
const dialogInitialData = ref<EventFormData | null>(null);
const dialogKey = ref(0);

const ACTION_REGISTRY = getUIActionRegistry();

const getFormComponent = (atype: string) => {
    const e = ACTION_REGISTRY[atype];
    return e ? e.component : null;
};

watch(() => props.show, (newShow) => {
    if (newShow) {
        if (props.editingShortcut) {
            capturedKeys.value = [...props.editingShortcut.keys];
            // populate actions from editingShortcut
            actions.value = props.editingShortcut.actions.map((a: any) => {
                const registryEntry = ACTION_REGISTRY[a.type];
                const data = registryEntry?.getInitial ? registryEntry.getInitial(a) : {};
                return { actionType: a.type, ...data } as EventFormData;
            });
        } else {
            capturedKeys.value = [];
            // start with no actions for a new shortcut; user must explicitly add one
            actions.value = [];
        }
    } else {
        stopKeyCapture();
    }
});

// when action types change, their forms manage initial data; nothing global to do


const closeDialog = () => {
    emit('close');
};

const saveShortcut = async () => {
    if (capturedKeys.value.length === 0) {
        alert('キーを設定してください');
        return;
    }
    // ask each child form to save into actions.value
    for (const idxStr of Object.keys(formRefs)) {
        const idx = Number(idxStr);
        formRefs[idx]?.save?.();
    }
    await nextTick();

    // validate and build events
    const now = new Date();
    const id = props.editingShortcut?.id || `shortcut-${Date.now()}`;
    const events: any[] = [];
    for (let i = 0; i < actions.value.length; i++) {
        const a = actions.value[i];
        const atype = a.actionType;
        const registryEntry = ACTION_REGISTRY[atype];
        if (!registryEntry) {
            alert(`未対応のアクションタイプ: ${atype}`);
            return;
        }
        const validate = registryEntry.validate;
        if (validate && !validate(a.data)) return;
        try {
            const ev = registryEntry.buildEvent(id, now, a.data);
            events.push(ev);
        } catch (err) {
            console.error(err);
            alert('アクションの作成に失敗しました');
            return;
        }
    }

    const shortcut = new KeyboardShortcut({ id, keys: capturedKeys.value, actions: events });
    emit('save', shortcut);
    closeActionDialog();
};

const addAction = () => {
    // Open the selection dialog for adding a new action
    dialogInitialData.value = null;
    dialogKey.value++;
    dialogOpen.value = true;
};

const removeAction = (idx: number) => {
    actions.value.splice(idx, 1);
};

const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const a = actions.value.splice(idx, 1)[0];
    actions.value.splice(idx - 1, 0, a);
};

const moveDown = (idx: number) => {
    if (idx >= actions.value.length - 1) return;
    const a = actions.value.splice(idx, 1)[0];
    actions.value.splice(idx + 1, 0, a);
};

function openActionManager(index: number) {
    // Open editor for existing action at index. Compute initial data from actions.
    const initial = { ...(actions.value[index] as EventFormData) };
    dialogInitialData.value = initial;
    dialogKey.value++;
    dialogOpen.value = true;
}

function onTypeSelected(payload: { type: string }) {
    const t = payload.type;
    const entry = ACTION_REGISTRY[t];
    const initial = entry && entry.getInitial ? entry.getInitial({}) : ({ actionType: t } as EventFormData);
    dialogInitialData.value = initial as EventFormData;
    dialogKey.value++;
}

function onEditorSave(dto: EventFormData & { eventId?: string }) {
    // Try to replace existing by eventId if present
    let replaced = false;
    if ((dto as any).eventId) {
        const idx = actions.value.findIndex(a => (a as any).eventId === (dto as any).eventId);
        if (idx >= 0) {
            actions.value.splice(idx, 1, dto as EventFormData);
            replaced = true;
        }
    }
    if (!replaced) {
        // fallback: replace by object identity if possible
        const idx = actions.value.findIndex(a => a === dialogInitialData.value);
        if (idx >= 0) {
            actions.value.splice(idx, 1, dto as EventFormData);
            replaced = true;
        }
    }
    if (!replaced) {
        actions.value.push(dto as EventFormData);
    }
    closeActionDialog();
}

function onDialogCancel() {
    closeActionDialog();
}

function closeActionDialog() {
    dialogInitialData.value = null;
    dialogOpen.value = false;
}
</script>

<style scoped>
.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
}

.dialog {
    background: #333;
    color: #fff;
    padding: 20px;
    border-radius: 8px;
    width: 600px;
    height: 400px;
    max-width: 90%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.dialog h3 {
    margin-top: 0;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
}

.form-group input,
.form-group select,
.form-group button {
    width: 100%;
    padding: 8px;
    border: 1px solid #555;
    border-radius: 4px;
    background: #444;
    color: #fff;
}

.dialog-buttons {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.save-btn,
.cancel-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.save-btn {
    background: #28a745;
    color: white;
}

.cancel-btn {
    background: #6c757d;
    color: white;
}

.key-input-section {
    display: flex;
    gap: 10px;
    align-items: center;
}

.captured-keys {
    flex: 1;
}

.button-group {
    flex-shrink: 0;
}

.clear-btn {
    width: auto;
}

.start-btn,
.stop-btn,
.clear-btn {
    padding: 8px 16px;
    border: 1px solid #666;
    border-radius: 4px;
    background: #fff;
    color: #222;
    cursor: pointer;
    font-weight: 600;
}

.start-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.stop-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.clear-btn {
    background: #6c757d;
    color: white;
}

.clear-btn:disabled {
    background: #444;
    cursor: not-allowed;
}

.form-content {
    flex-grow: 1;
}
</style>