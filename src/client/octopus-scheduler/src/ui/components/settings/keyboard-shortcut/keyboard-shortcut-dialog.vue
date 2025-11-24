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
                    <action-item-summary v-for="(action, idx) in actions" :key="keyFor(action, idx)" :action="action"
                        :index="idx" :length="actions.length" @edit="openActionManager" @move-up="moveUp"
                        @move-down="moveDown" @remove="removeAction" />
                </div>
                <div class="add-action">
                    <button @click="addAction">アクションを追加</button>
                </div>
            </div>

            <!-- Dialog area: mounted only when dialogOpen is true -->
            <div v-if="dialogOpen" class="dialog-content">
                <!-- Selection UI inside parent dialog -->
                <event-selection-dialog v-if="selectionOpen" :show="true" @select-type="onTypeSelected"
                    @cancel="onDialogCancel" />

                <!-- Legacy inline form (kept for compatibility) -->
                <component v-if="!selectionOpen && dialogInitialData && !editorDialogOpen"
                    :is="getFormComponent(dialogInitialData.actionType)" :initialData="dialogInitialData"
                    @save="onEditorSave" @cancel="onDialogCancel" ref="currentEditor" />
            </div>

            <!-- Editor modal (separate overlay) -->
            <action-editor-dialog ref="actionEditorRef" v-if="editorDialogOpen" :show="editorDialogOpen"
                :initialData="editorInitialData" @save="onEditorSave" @cancel="closeEditorDialog" />
            <div class="dialog-buttons">
                <button @click="saveShortcut" class="save-btn">保存</button>
                <button @click="closeDialog" class="cancel-btn">キャンセル</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { KeyboardShortcut } from '../../../../model/domains/keyboard-shortcut/keyboard-shortcut';
import { useKeyCapture } from './composables/useKeyCapture';
import ActionItemSummary from './action-item-summary.vue';
import EventSelectionDialog from './event-selection-dialog.vue';
import ActionEditorDialog from './action-editor-dialog.vue';
import type { EventFormData } from './types';
import { IAppEventConverterToken } from '../../../../model/domains/app-event/i-app-event-converter';
import { container } from 'tsyringe';
import { AppEventService } from '../../../../model/applications/app-event/app-event-service';
import { UIActionEntryToken } from '../../../../core/container';

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

// selection vs editor modal separation
const selectionOpen = ref(false);
const editorDialogOpen = ref(false);
const editorInitialData = ref<EventFormData | null>(null);

// editing target index in actions list (-1 = new)
const editingIndex = ref<number>(-1);

// ref to action editor component
const actionEditorRef = ref<any | null>(null);

// build a local registry map from DI-resolved UI action entries
const ACTION_REGISTRY: Record<string, any> = (() => {
    try {
        const entries = container.resolveAll<any>(UIActionEntryToken as any) as any[];
        const map: Record<string, any> = {};
        for (const e of entries) {
            if (e && e.actionType) map[e.actionType] = e;
        }
        return map;
    } catch (err) {
        return {};
    }
})();
const appEventService = container.resolve(AppEventService);

const resolveActionData = (a: any) => {
    if (!a) return {};
    if ('data' in a && a.data != null) return a.data;
    // build data from top-level fields excluding actionType and eventId
    const { actionType, eventId, ...rest } = a as Record<string, any>;
    return rest || {};
};

const getFormComponent = (atype: string) => {
    const e = ACTION_REGISTRY[atype];
    return e ? e.component : null;
};

watch(() => props.show, (newShow) => {
    if (newShow) {
        if (props.editingShortcut) {
            capturedKeys.value = [...props.editingShortcut.keys];
            // populate actions from editingShortcut using centralized service
            actions.value = props.editingShortcut.actions.map((a: any) => {
                const atype = a.type;
                let data: any = {};
                try {
                    // resolve converters from DI and find matching converter by getType
                    const converters = container.resolveAll<any>(IAppEventConverterToken as any) as any[];
                    const conv = converters.find((c) => c && typeof c.getType === 'function' && (() => { try { return c.getType() === atype; } catch { return false; } })());
                    if (conv && typeof conv.toDto === 'function') {
                        try {
                            data = conv.toDto(a);
                        } catch (err) {
                            const entry = ACTION_REGISTRY[atype];
                            if (entry && typeof entry.defaultData === 'function') {
                                data = entry.defaultData(a);
                            } else {
                                data = appEventService.getDefault(atype) as any;
                            }
                        }
                    } else {
                        const entry = ACTION_REGISTRY[atype];
                        if (entry && typeof entry.defaultData === 'function') {
                            data = entry.defaultData(a);
                        } else {
                            data = appEventService.getDefault(atype) as any;
                        }
                    }
                } catch (e) {
                    const entry = ACTION_REGISTRY[atype];
                    if (entry && typeof entry.defaultData === 'function') {
                        data = entry.defaultData(a);
                    } else {
                        data = appEventService.getDefault(atype) as any;
                    }
                }
                return { actionType: atype, ...data } as EventFormData;
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
    const id = props.editingShortcut?.id || `shortcut-${Date.now()}`;
    const events: any[] = [];
    for (let i = 0; i < actions.value.length; i++) {
        const a = actions.value[i];
        const atype = a.actionType;
        const data = resolveActionData(a);
        const converters = container.resolveAll<any>(IAppEventConverterToken as any) as any[];
        const converter = converters.find((c) => c && typeof c.getType === 'function' && (() => { try { return c.getType() === atype; } catch { return false; } })());
        if (!converter) {
            alert(`未対応のアクションタイプ: ${atype}`);
            return;
        }
        const validate = (converter as any).validate;
        if (validate && !validate(data)) return;
        try {
            let ev: any;
            if (typeof (converter as any).toEntity === 'function') {
                ev = (converter as any).toEntity(data);
            } else {
                alert(`未対応のアクションタイプ: ${atype}`);
                return;
            }
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
    // mark editing index as new
    editingIndex.value = -1;
    // open selection UI inside parent dialog
    selectionOpen.value = true;
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

async function openActionManager(index: number) {
    // Open editor for existing action at index. Compute initial data from actions.
    const initial = { ...(actions.value[index] as EventFormData) };
    // set editing target and open editor modal with initial data
    editingIndex.value = index;
    editorInitialData.value = initial;
    editorDialogOpen.value = true;
    // ensure selection UI is closed
    selectionOpen.value = false;
    // wait mount and reset child form (await nextTick and retry a few ticks if needed)
    await nextTick();
    for (let i = 0; i < 3 && !actionEditorRef.value?.reset; i++) {
        await nextTick();
    }
    actionEditorRef.value?.reset?.();
}

async function onTypeSelected(payload: { type: string }) {
    const t = payload.type;
    // close selection and open editor modal with initial DTO
    selectionOpen.value = false;
    const initial = appEventService.getDefault(t) as EventFormData;
    editorInitialData.value = initial;
    // indicate this is a new item
    editingIndex.value = -1;
    editorDialogOpen.value = true;
    // wait and ensure child is mounted/exposed before calling reset
    await nextTick();
    for (let i = 0; i < 3 && !actionEditorRef.value?.reset; i++) {
        await nextTick();
    }
    actionEditorRef.value?.reset?.();
}

function onEditorSave(dto: EventFormData & { eventId?: string }) {
    // Replace by eventId if present
    if ((dto as any).eventId) {
        const idx = actions.value.findIndex(a => (a as any).eventId === (dto as any).eventId);
        if (idx >= 0) {
            actions.value.splice(idx, 1, dto as EventFormData);
            editingIndex.value = -1;
            closeEditorDialog();
            return;
        }
    }
    // If editingIndex set, replace at that index
    if (editingIndex.value >= 0) {
        actions.value.splice(editingIndex.value, 1, dto as EventFormData);
        editingIndex.value = -1;
        closeEditorDialog();
        return;
    }
    // otherwise add new
    actions.value.push(dto as EventFormData);
    // close editor modal (not the parent dialog)
    closeEditorDialog();
}

function onDialogCancel() {
    // cancel from selection dialog or editor
    if (selectionOpen.value) selectionOpen.value = false;
    if (editorDialogOpen.value) closeEditorDialog();
}

function closeActionDialog() {
    dialogInitialData.value = null;
    dialogOpen.value = false;
    selectionOpen.value = false;
    editorDialogOpen.value = false;
}

function closeEditorDialog() {
    editorInitialData.value = null;
    editorDialogOpen.value = false;
    editingIndex.value = -1;
}

// Provide a stable key for v-for rendering. Prefer existing eventId/actionId if present.
const keyFor = (a: any, idx: number) => {
    return a?.eventId ?? a?.actionId ?? `local-${idx}-${a?.actionType ?? 'act'}`;
};
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