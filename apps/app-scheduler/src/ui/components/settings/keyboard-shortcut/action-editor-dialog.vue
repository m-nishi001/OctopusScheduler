<template>
    <div v-if="show" class="editor-overlay" @click="onOverlayClick">
        <div class="editor-dialog" @click.stop>
            <h4>アクション編集</h4>
            <div class="editor-content">
                <component v-if="formComponent && initialData" ref="editorRef" :is="formComponent"
                    :initialData="initialData" @save="onSave" @cancel="onCancel" />
                <div v-else class="no-form">フォームが見つかりません</div>
            </div>
            <div class="editor-buttons">
                <button @click="onOk">OK</button>
                <button @click="onCancel">キャンセル</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { container } from 'tsyringe';
import { UIActionEntryToken } from '../../../../core/container';
import type { EventFormData } from './types';
import type { IAppEventDto } from '../../../../model/applications/app-event/i-app-event-dto';

interface Props {
    show: boolean;
    initialData: EventFormData | IAppEventDto | null;
}

const props = defineProps<Props>();
const emit = defineEmits(['save', 'cancel']);

const editorRef = ref<any | null>(null);

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

const formComponent = computed(() => {
    if (!props.initialData) return null;
    const e = ACTION_REGISTRY[props.initialData.actionType];
    return e ? e.component : null;
});

// When initialData changes, forward reset to the inner editor component
watch(() => props.initialData, () => {
    try {
        editorRef.value?.reset?.();
    } catch (e) {
        // ignore
    }
});

function onSave(dto: any) {
    emit('save', dto);
}
function onCancel() {
    emit('cancel');
}
function onOverlayClick() {
    emit('cancel');
}

async function onOk() {
    try {
        const saveFn = editorRef.value?.save;
        if (typeof saveFn === 'function') {
            const res = saveFn.call(editorRef.value);
            if (res && typeof res.then === 'function') await res;
        }
    } catch (err) {
        // ignore
    }
}

function reset() {
    editorRef.value?.reset?.();
}

defineExpose({ reset });
</script>

<style scoped>
.editor-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

.editor-dialog {
    background: #222;
    color: #fff;
    padding: 18px;
    border-radius: 8px;
    width: 560px;
    max-width: 90%;
}

.editor-content {
    margin-top: 8px;
}

.editor-buttons {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
    gap: 8px;
}

.no-form {
    color: #ccc;
}
</style>
