<template>
    <UiDialog :model-value="show" title="新しい景品を追加" size="xl" :close-on-overlay="false" @close="closeModal">
        <PrizeForm ref="formRef" mode="add" :other-prizes="otherPrizes" @submit="onSubmit" @cancel="closeModal" />
        <template #footer>
            <UiButton @click="closeModal">キャンセル</UiButton>
            <UiButton variant="primary" @click="onFormSubmit">保存</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import PrizeForm from '../../../components/prizes/prize-form.vue';
import type { Prize, PrizeFields } from '@model/prize/prize';
import { PrizeService } from '@control/prize/prize-service';
import { container } from 'tsyringe';

const props = defineProps({
    show: { type: Boolean, required: false },
    otherPrizes: { type: Array as () => Prize[], default: () => [] },
});

const emit = defineEmits(['close', 'refresh']);

const closeModal = () => {
    emit('close');
};

import { ref } from 'vue';
const formRef = ref(null as any);

const onFormSubmit = async () => {
    if (formRef && formRef.value && typeof formRef.value.submit === 'function') {
        await formRef.value.submit();
    }
};

const onSubmit = async ({ fields, files }: { fields: PrizeFields; files: Map<string, File> }) => {
    try {
        const prizeService = container.resolve(PrizeService);
        await prizeService.addPrize(fields, files);
        emit('refresh');
        closeModal();
    } catch (error) {
        console.error('Failed to save prize:', error);
        // Optionally show user error
    }
};
</script>
