<template>
    <div class="form-group">
        <label>コンテンツタイプ:</label>
        <select v-model="formData.contentType">
            <option value="image">画像</option>
            <option value="movie">動画</option>
            <option value="html">HTML</option>
        </select>
    </div>
    <div class="form-group">
        <label>コンテンツID:</label>
        <input v-model="formData.contentId" type="text" placeholder="content-123" />
    </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

interface Props {
    initialData: { contentType?: string; contentId?: string };
}

const props = defineProps<Props>();
const emit = defineEmits<{ save: [data: any] }>();

const formData = reactive({
    contentType: props.initialData.contentType || 'image',
    contentId: props.initialData.contentId || '',
});

const save = () => {
    emit('save', { actionType: 'ShowContentEvent', ...formData });
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