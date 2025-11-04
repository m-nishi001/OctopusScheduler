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