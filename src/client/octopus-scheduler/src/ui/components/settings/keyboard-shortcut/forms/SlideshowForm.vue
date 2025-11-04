<template>
    <div class="form-group">
        <label>フォルダID:</label>
        <input v-model="formData.folderId" type="text" placeholder="folder-123" />
    </div>
    <div class="form-group">
        <label>表示時間 (秒):</label>
        <input v-model.number="formData.displayDuration" type="number" placeholder="10" />
    </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

interface Props {
    initialData: { folderId?: string; displayDuration?: number };
}

const props = defineProps<Props>();
const emit = defineEmits<{ save: [data: any] }>();

const formData = reactive({
    folderId: props.initialData.folderId || '',
    displayDuration: props.initialData.displayDuration || 10,
});

const save = () => {
    emit('save', { actionType: 'SlideshowEvent', ...formData });
};

defineExpose({ save });
</script>