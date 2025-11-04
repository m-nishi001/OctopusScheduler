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

        <!-- 追加/編集ダイアログ -->
        <div v-if="showDialog" class="dialog-overlay" @click="closeDialog">
            <div class="dialog" @click.stop>
                <h3>{{ editingShortcut ? '編集' : '追加' }} キーボードショートカット</h3>
                <div class="form-group">
                    <label>キー組み合わせ:</label>
                    <div class="key-input-section">
                        <input readonly class="captured-keys"
                            :value="capturedKeys.length > 0 ? capturedKeys.join(' + ') : ''"
                            placeholder="キーがここに表示されます" />

                        <button @click="toggleCapture" class="capture-btn"
                            :class="{ listening: capturing && capturedKeys.length === 0, recording: capturing && capturedKeys.length > 0 }">
                            <span v-if="!capturing" class="icon">⌨️</span>
                            <span v-else-if="capturing && capturedKeys.length === 0" class="icon">⏹️</span>
                            <span v-else class="icon">🔴</span>
                        </button>

                        <button @click="clearKeys" class="clear-btn" :disabled="capturedKeys.length === 0">🗑️</button>
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
                <div v-if="actionType === 'TransitionPageEvent'" class="form-group">
                    <label>遷移URL:</label>
                    <input v-model="transitionUrl" type="text" placeholder="/jackpot-game" />
                </div>
                <div v-if="actionType === 'PlayAudioEvent'" class="form-group">
                    <label>音声ID:</label>
                    <input v-model="audioId" type="text" placeholder="audio-123" />
                </div>
                <div v-if="actionType === 'SlideshowEvent'" class="form-group">
                    <label>フォルダID:</label>
                    <input v-model="folderId" type="text" placeholder="folder-123" />
                    <label>表示時間 (秒):</label>
                    <input v-model.number="displayDuration" type="number" placeholder="10" />
                </div>
                <div v-if="actionType === 'ShowContentEvent'" class="form-group">
                    <label>コンテンツタイプ:</label>
                    <select v-model="contentType">
                        <option value="image">画像</option>
                        <option value="movie">動画</option>
                        <option value="html">HTML</option>
                    </select>
                    <label>コンテンツID:</label>
                    <input v-model="contentId" type="text" placeholder="content-123" />
                </div>
                <div class="dialog-buttons">
                    <button @click="saveShortcut" class="save-btn">保存</button>
                    <button @click="closeDialog" class="cancel-btn">キャンセル</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { container } from 'tsyringe';
import { KeyboardShortcutService } from '../../../../model/applications/keyboard-shortcut/keyboard-shortcut-service';
import { KeyboardShortcut } from '../../../../model/domains/keyboard-shortcut/keyboard-shortcut';
import { KeyboardShortcutConfig } from '../../../../model/domains/keyboard-shortcut/keyboard-shortcut-config';
import { TransitionPageEvent } from '../../../../model/domains/schedule-event/transition/transition-page-event';
import { PlayAudioEvent } from '../../../../model/domains/schedule-event/play-audio/play-audio-event';
import { SlideshowEvent } from '../../../../model/domains/schedule-event/slideshow/slideshow-event';
import { ShowContentEvent } from '../../../../model/domains/schedule-event/show-content/show-content-event';

const shortcuts = ref<KeyboardShortcut[]>([]);
const isEnabled = ref(true);
const service = container.resolve(KeyboardShortcutService);

// ダイアログ関連
const showDialog = ref(false);
const editingShortcut = ref<KeyboardShortcut | null>(null);
const capturedKeys = ref<string[]>([]);
const capturing = ref(false);
const actionType = ref('TransitionPageEvent');
const transitionUrl = ref('');
const audioId = ref('');
const folderId = ref('');
const displayDuration = ref(10);
const contentType = ref('image');
const contentId = ref('');

let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
let keyupHandler: ((event: KeyboardEvent) => void) | null = null;

onMounted(async () => {
    await loadShortcuts();
    await loadConfig();
});

onUnmounted(() => {
    stopKeyCapture();
});

const loadShortcuts = async () => {
    shortcuts.value = await service.getKeyboardShortcuts();
};

const loadConfig = async () => {
    const config = await service.getConfig();
    isEnabled.value = config.enabled;
};

const onToggleEnabled = async () => {
    const config = new KeyboardShortcutConfig(isEnabled.value);
    await service.saveConfig(config);
};

const onAdd = () => {
    editingShortcut.value = null;
    capturedKeys.value = [];
    actionType.value = 'TransitionPageEvent';
    transitionUrl.value = '';
    audioId.value = '';
    folderId.value = '';
    displayDuration.value = 10;
    contentType.value = 'image';
    contentId.value = '';
    showDialog.value = true;
}; const onEdit = (shortcut: KeyboardShortcut) => {
    editingShortcut.value = shortcut;
    capturedKeys.value = [...shortcut.keys];
    actionType.value = shortcut.action.type;
    if (shortcut.action.type === 'TransitionPageEvent') {
        transitionUrl.value = (shortcut.action as any).transitionUrl || '';
        audioId.value = '';
        folderId.value = '';
        displayDuration.value = 10;
        contentType.value = 'image';
        contentId.value = '';
    } else if (shortcut.action.type === 'PlayAudioEvent') {
        transitionUrl.value = '';
        audioId.value = (shortcut.action as any).audioId || '';
        folderId.value = '';
        displayDuration.value = 10;
        contentType.value = 'image';
        contentId.value = '';
    } else if (shortcut.action.type === 'SlideshowEvent') {
        transitionUrl.value = '';
        audioId.value = '';
        folderId.value = (shortcut.action as any).folderId || '';
        displayDuration.value = (shortcut.action as any).displayDuration || 10;
        contentType.value = 'image';
        contentId.value = '';
    } else if (shortcut.action.type === 'ShowContentEvent') {
        transitionUrl.value = '';
        audioId.value = '';
        folderId.value = '';
        displayDuration.value = 10;
        contentType.value = (shortcut.action as any).contentType || 'image';
        contentId.value = (shortcut.action as any).contentId || '';
    }
    showDialog.value = true;
};

const onDelete = async (id: string) => {
    if (confirm('削除しますか？')) {
        await service.deleteKeyboardShortcut(id);
        await loadShortcuts();
    }
};

const startKeyCapture = () => {
    capturing.value = true;
    capturedKeys.value = [];
    keydownHandler = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        updateCapturedKeys(event);
    };
    keyupHandler = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        updateCapturedKeys(event);
    };
    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keyup', keyupHandler);
};

const stopKeyCapture = () => {
    if (keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }
    if (keyupHandler) {
        window.removeEventListener('keyup', keyupHandler);
        keyupHandler = null;
    }
    capturing.value = false;
};

const toggleCapture = () => {
    if (capturing.value) {
        stopKeyCapture();
    } else {
        startKeyCapture();
    }
};

const updateCapturedKeys = (event: KeyboardEvent) => {
    const keys: string[] = [];
    if (event.ctrlKey || (event.type === 'keydown' && event.key === 'Control')) keys.push('Control');
    if (event.shiftKey || (event.type === 'keydown' && event.key === 'Shift')) keys.push('Shift');
    if (event.altKey || (event.type === 'keydown' && event.key === 'Alt')) keys.push('Alt');
    if (event.metaKey || (event.type === 'keydown' && event.key === 'Meta')) keys.push('Meta');
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
        keys.push(event.key);
    }
    capturedKeys.value = keys;
};

const clearKeys = () => {
    capturedKeys.value = [];
    capturing.value = false;
    stopKeyCapture();
};

const saveShortcut = async () => {
    if (capturedKeys.value.length === 0) {
        alert('キーを設定してください');
        return;
    }

    // 重複チェック
    const existing = await service.findShortcutByKeys(capturedKeys.value);
    if (existing && existing.id !== editingShortcut.value?.id) {
        alert('このキー組み合わせは既に使用されています');
        return;
    }

    let event: any;
    const now = new Date();
    const id = editingShortcut.value?.id || `shortcut-${Date.now()}`;

    if (actionType.value === 'TransitionPageEvent') {
        if (!transitionUrl.value) {
            alert('URLを入力してください');
            return;
        }
        event = TransitionPageEvent.fromParams({
            id,
            startTime: now,
            endTime: new Date(now.getTime() + 1000),
            transitionUrl: transitionUrl.value,
            fadeOutDuration: 0,
            processedAt: null,
            registeredAt: now,
            updatedAt: now,
        });
    } else if (actionType.value === 'PlayAudioEvent') {
        if (!audioId.value) {
            alert('音声IDを入力してください');
            return;
        }
        event = PlayAudioEvent.fromParams({
            id,
            startTime: now,
            endTime: new Date(now.getTime() + 1000),
            audioId: audioId.value,
            fadeOutDuration: 0,
            processedAt: null,
            registeredAt: now,
            updatedAt: now,
        });
    } else if (actionType.value === 'SlideshowEvent') {
        if (!folderId.value || !displayDuration.value) {
            alert('フォルダIDと表示時間を入力してください');
            return;
        }
        event = SlideshowEvent.fromParams({
            id,
            startTime: now,
            endTime: new Date(now.getTime() + 1000),
            folderId: folderId.value,
            displayDuration: displayDuration.value,
            transitionType: 'fade',
            slideDirection: undefined,
            bgmIds: [],
            processedAt: null,
            registeredAt: now,
            updatedAt: now,
        });
    } else if (actionType.value === 'ShowContentEvent') {
        if (!contentId.value) {
            alert('コンテンツIDを入力してください');
            return;
        }
        event = ShowContentEvent.fromParams({
            id,
            startTime: now,
            endTime: new Date(now.getTime() + 1000),
            contentType: contentType.value as 'image' | 'movie' | 'html',
            contentId: contentId.value,
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

    if (editingShortcut.value) {
        await service.deleteKeyboardShortcut(editingShortcut.value.id);
    }
    await service.addKeyboardShortcut(shortcut);
    await loadShortcuts();
    closeDialog();
}; const closeDialog = () => {
    showDialog.value = false;
    stopKeyCapture();
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
    width: 400px;
    max-width: 90%;
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

.key-input-section {
    display: flex;
    align-items: center;
    gap: 10px;
}

.capture-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 6px;
    border: 1px solid #666;
    background: #fff;
    /* default neutral */
    color: #222;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
}

.capture-btn.listening {
    background: #ffffff;
    /* white when waiting for input */
    color: #222;
}

.capture-btn.recording {
    background: #e74848;
    /* red when a key has been captured */
    color: #fff;
    border-color: #c33;
}

.rec-dot {
    width: 10px;
    height: 10px;
    background: #fff;
    border-radius: 50%;
    display: inline-block;
}

.captured-keys {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid #555;
    border-radius: 6px;
    background: #2d2d2d;
    color: #fff;
    min-height: 38px;
    font-family: inherit;
}

.clear-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.clear-btn:disabled {
    background: #444;
    cursor: not-allowed;
}

.icon {
    font-size: 1.2em;
}
</style>