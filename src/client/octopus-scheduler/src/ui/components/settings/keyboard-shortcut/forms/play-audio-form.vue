<template>
    <div class="form-group">
        <label>音声ID:</label>
        <input v-model="formData.audioId" type="text" placeholder="audio-123" />
    </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

interface Props {
    initialData: { audioId?: string };
}

const props = defineProps<Props>();
const emit = defineEmits<{ save: [data: any] }>();

const formData = reactive({
    audioId: props.initialData.audioId || '',
});

const save = () => {
    emit('save', { actionType: 'PlayAudioEvent', ...formData });
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