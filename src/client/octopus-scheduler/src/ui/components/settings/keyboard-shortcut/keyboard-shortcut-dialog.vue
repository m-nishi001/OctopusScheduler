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
                    <option value="TransitionPageEvent">画面遷移</option>
                    <option value="PlayAudioEvent">音声再生</option>
                    <option value="SlideshowEvent">スライドショー</option>
                    <option value="ShowContentEvent">コンテンツ表示</option>
                </select>
            </div>
            <component :is="currentFormComponent" :initial-data="initialData" @save="handleFormSave"
                class="form-content" />
            <div class="dialog-buttons">
                <button @click="saveShortcut" class="save-btn">保存</button>
                <button @click="closeDialog" class="cancel-btn">キャンセル</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { KeyboardShortcut } from '../../../../model/domains/keyboard-shortcut/keyboard-shortcut';
import { TransitionPageEvent } from '../../../../model/domains/schedule-event/transition/transition-page-event';
import { PlayAudioEvent } from '../../../../model/domains/schedule-event/play-audio/play-audio-event';
import { SlideshowEvent } from '../../../../model/domains/schedule-event/slideshow/slideshow-event';
import { ShowContentEvent } from '../../../../model/domains/schedule-event/show-content/show-content-event';
import { useKeyCapture } from './composables/useKeyCapture';
import TransitionPageForm from './forms/transition-page-form.vue';
import PlayAudioForm from './forms/play-audio-form.vue';
import SlideshowForm from './forms/slideshow-form.vue';
import ShowContentForm from './forms/show-content-form.vue';

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

const currentFormComponent = computed(() => {
    switch (actionType.value) {
        case 'TransitionPageEvent': return TransitionPageForm;
        case 'PlayAudioEvent': return PlayAudioForm;
        case 'SlideshowEvent': return SlideshowForm;
        case 'ShowContentEvent': return ShowContentForm;
        default: return null;
    }
});

const initialData = computed(() => {
    if (props.editingShortcut) {
        const action = props.editingShortcut.action;
        switch (action.type) {
            case 'TransitionPageEvent': return { transitionUrl: (action as any).transitionUrl };
            case 'PlayAudioEvent': return { audioId: (action as any).audioId };
            case 'SlideshowEvent': return { folderId: (action as any).folderId, displayDuration: (action as any).displayDuration };
            case 'ShowContentEvent': return { contentType: (action as any).contentType, contentId: (action as any).contentId };
            default: return {};
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

    const data = formData.value;
    if (!data || !data.actionType) {
        alert('フォームデータを入力してください');
        return;
    }

    let event: any;
    const now = new Date();
    const id = props.editingShortcut?.id || `shortcut-${Date.now()}`;

    if (data.actionType === 'TransitionPageEvent') {
        if (!data.transitionUrl) {
            alert('URLを入力してください');
            return;
        }
        event = TransitionPageEvent.fromParams({
            id,
            startTime: now,
            endTime: new Date(now.getTime() + 1000),
            transitionUrl: data.transitionUrl,
            fadeOutDuration: 0,
            processedAt: null,
            registeredAt: now,
            updatedAt: now,
        });
    } else if (data.actionType === 'PlayAudioEvent') {
        if (!data.audioId) {
            alert('音声IDを入力してください');
            return;
        }
        event = PlayAudioEvent.fromParams({
            id,
            startTime: now,
            endTime: new Date(now.getTime() + 1000),
            audioId: data.audioId,
            fadeOutDuration: 0,
            processedAt: null,
            registeredAt: now,
            updatedAt: now,
        });
    } else if (data.actionType === 'SlideshowEvent') {
        if (!data.folderId || !data.displayDuration) {
            alert('フォルダIDと表示時間を入力してください');
            return;
        }
        event = SlideshowEvent.fromParams({
            id,
            startTime: now,
            endTime: new Date(now.getTime() + 1000),
            folderId: data.folderId,
            displayDuration: data.displayDuration,
            transitionType: 'fade',
            slideDirection: undefined,
            bgmIds: [],
            processedAt: null,
            registeredAt: now,
            updatedAt: now,
        });
    } else if (data.actionType === 'ShowContentEvent') {
        if (!data.contentId) {
            alert('コンテンツIDを入力してください');
            return;
        }
        event = ShowContentEvent.fromParams({
            id,
            startTime: now,
            endTime: new Date(now.getTime() + 1000),
            contentType: data.contentType as 'image' | 'movie' | 'html',
            contentId: data.contentId,
            htmlString: undefined,
            displayMode: 'fade',
            effect: 'fade',
            duration: 10,
            fadeInTime: 1,
            fadeOutTime: 1,
            scrollDirection: undefined,
            processedAt: null,
            registeredAt: now,
            updatedAt: now,
        });
    } else {
        alert('未対応のアクションタイプです');
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