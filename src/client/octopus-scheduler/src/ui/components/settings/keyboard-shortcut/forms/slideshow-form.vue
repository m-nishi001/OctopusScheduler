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