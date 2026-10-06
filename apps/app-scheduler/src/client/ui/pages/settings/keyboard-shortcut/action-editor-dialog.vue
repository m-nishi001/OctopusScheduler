<template>
    <UiDialog :model-value="show" title="アクション編集" size="md" nested :close-on-overlay="false"
        @close="onCancel">
        <component v-if="formComponent && initialData" ref="editorRef" :is="formComponent"
            :initialData="initialData" @save="onSave" @cancel="onCancel" />
        <div v-else class="no-form">フォームが見つかりません</div>
        <template #footer>
            <UiButton @click="onCancel">キャンセル</UiButton>
            <UiButton variant="primary" @click="onOk">OK</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { uiActionEntries } from '../app-events/registry';
import type { EventFormHandle } from '../app-events/ui-action-entry';
import type { AppEventDto } from '../../../../control/app-event/dto/app-event-dto';

interface Props {
    show: boolean;
    initialData: AppEventDto | null;
}

const props = defineProps<Props>();
const emit = defineEmits(['save', 'cancel']);

const editorRef = ref<EventFormHandle | null>(null);

const ACTION_REGISTRY = Object.fromEntries(
    uiActionEntries.map((e) => [e.actionType, e])
);

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

async function onOk() {
    try {
        await editorRef.value?.save();
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
.no-form {
    color: var(--ui-text-muted, #cfd6dd);
}
</style>
