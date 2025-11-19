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
                <label>アクションタイプ:</label>
                <select v-model="actionType">
                    <option v-for="(entry, key) in actionOptions" :key="key" :value="key">{{ entry.label }}</option>
                </select>
            </div>
            <div class="form-content">
                <component :is="currentFormComponent" :initial-data="initialData" @save="handleFormSave" ref="formRef">
                </component>
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

const actionType = ref('TransitionPageEvent');
const formData = ref<any>({});
const formRef = ref();

const ACTION_REGISTRY = getUIActionRegistry();

const currentFormComponent = computed(() => {
    const e = ACTION_REGISTRY[actionType.value];
    return e ? e.component : null;
});

const actionOptions = computed(() => ACTION_REGISTRY);

const initialData = computed(() => {
    if (props.editingShortcut) {
        const action: any = props.editingShortcut.action;
        const registryEntry = ACTION_REGISTRY[action.type];
        if (registryEntry?.getInitial) {
            return registryEntry.getInitial(action);
        }
    }
    return {};
});

const handleFormSave = (data: any) => {
    formData.value = data;
};

watch(() => props.show, (newShow) => {
    if (newShow) {
        if (props.editingShortcut) {
            capturedKeys.value = [...props.editingShortcut.keys];
            actionType.value = props.editingShortcut.action.type;
        } else {
            capturedKeys.value = [];
            actionType.value = 'TransitionPageEvent';
            formData.value = {};
        }
    } else {
        stopKeyCapture();
    }
});

watch(() => actionType.value, () => {
    formData.value = {};
});

const closeDialog = () => {
    emit('close');
};

const saveShortcut = async () => {
    if (capturedKeys.value.length === 0) {
        alert('キーを設定してください');
        return;
    }

    formRef.value?.save();
    await nextTick();

    const data = formData.value;
    if (!data) {
        alert('フォームデータを入力してください');
        return;
    }
    let event: any;
    const atype = data.actionType || actionType.value;
    const registryEntry = ACTION_REGISTRY[atype];
    if (!registryEntry) {
        alert('未対応のアクションタイプです');
        return;
    }
    const now = new Date();
    const id = props.editingShortcut?.id || `shortcut-${Date.now()}`;

    // perform simple validation if the registry provides a validator
    const validate = registryEntry.validate;
    if (validate && !validate(data)) {
        return; // validate should show alert
    }

    // build event through registry
    try {
        event = registryEntry.buildEvent(id, now, data);
    } catch (err) {
        console.error(err);
        alert('アクションの作成に失敗しました');
        return;
    }

    const shortcut = new KeyboardShortcut({
        id,
        keys: capturedKeys.value,
        action: event,
    });

    emit('save', shortcut);
    closeDialog();
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