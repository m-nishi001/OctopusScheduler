<template>
    <UiDialog :model-value="visible" title="未保存の変更があります" size="sm" nested :close-on-overlay="false"
        @close="handleCancel">
        <p class="message">変更を保存せずに移動すると、変更内容とアップロードされたアセットが破棄されます。</p>
        <p class="message">変更を保存しますか？</p>
        <template #footer>
            <UiButton @click="handleCancel">キャンセル</UiButton>
            <UiButton variant="danger" @click="handleDiscard">破棄して移動</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';

const emit = defineEmits<{
    discard: [];
    cancel: [];
}>();

defineProps<{
    visible: boolean;
}>();

const handleDiscard = () => {
    emit('discard');
};

const handleCancel = () => {
    emit('cancel');
};
</script>

<style scoped>
.message {
    margin: 0 0 var(--ui-space-2, 8px);
}
</style>
