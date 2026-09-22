<template>
    <div v-bind="$attrs">
        <div class="form-group">
            <label>フォルダID:</label>
            <input v-model="formData.folderId" type="text" placeholder="folder-123" />
        </div>
        <div class="form-group">
            <label>表示時間 (秒):</label>
            <input v-model.number="formData.displayDuration" type="number" placeholder="10" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { SlideshowFormData, EditSlideshowFormData } from '../../app-events/types';

type Props = { initialData?: SlideshowFormData | EditSlideshowFormData }

const props = defineProps<Props>();
const emit = defineEmits<{ save: [SlideshowFormData | EditSlideshowFormData] }>();

const formData = reactive({ folderId: props.initialData?.folderId ?? '', displayDuration: props.initialData?.displayDuration ?? 10 });

const save = () => {
    const base: SlideshowFormData = { actionType: 'SlideshowEvent', folderId: formData.folderId, displayDuration: formData.displayDuration };
    if (props.initialData && 'eventId' in props.initialData) {
        const out: EditSlideshowFormData = { ...(base as any), eventId: (props.initialData as EditSlideshowFormData).eventId };
        emit('save', out);
    } else {
        emit('save', base);
    }
};

const reset = () => {
    formData.folderId = props.initialData?.folderId ?? '';
    formData.displayDuration = props.initialData?.displayDuration ?? 10;
};

watch(() => props.initialData, () => {
    reset();
});

defineExpose({ save, reset });
</script>

<style scoped>
.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 8px;
    border: 1px solid #555;
    border-radius: 4px;
    background: #444;
    color: #fff;
}
</style>
