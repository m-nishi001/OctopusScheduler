<template>
    <UiDialog :model-value="show" title="景品詳細" size="xl" :close-on-overlay="false" @close="closeModal">
        <PrizeForm ref="formRef" mode="edit" :prize="prize" :image-assets="imageAssets"
                            :audio-assets="audioAssets" :object-url-map="objectUrlMap" :other-prizes="otherPrizes"
                            @submit="onSubmit" @cancel="closeModal" />
        <template #footer>
            <UiButton @click="closeModal">キャンセル</UiButton>
            <UiButton variant="primary" @click="onFormSubmit">保存</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import PrizeForm from '../../../components/prizes/prize-form.vue';
import type { Asset } from '@model/asset/asset-data';
import type { Prize } from '@model/prize/prize';
import { PrizeService } from '@control/prize/prize-service';
import { container } from 'tsyringe';
import { ref } from 'vue';

const props = defineProps({
    show: { type: Boolean, required: false },
    prize: { type: Object, required: true },
    imageAssets: { type: Array as () => Asset[], required: true },
    audioAssets: { type: Array as () => Asset[], required: true },
    objectUrlMap: { type: Object, required: true },
    otherPrizes: { type: Array as () => Prize[], default: () => [] },
});

const emit = defineEmits(['close', 'refresh']);

const closeModal = () => {
    emit('close');
};

const formRef = ref(null as any);

const onFormSubmit = async () => {
    if (formRef && formRef.value && typeof formRef.value.submit === 'function') {
        await formRef.value.submit();
    }
};

const onSubmit = async (formData: any) => {
    try {
        const prizeService = container.resolve(PrizeService);
        await prizeService.updatePrize(props.prize.id, formData);
        emit('refresh');
        closeModal();
    } catch (error) {
        console.error('Failed to update prize:', error);
        // Optionally show user error
    }
};
</script>
