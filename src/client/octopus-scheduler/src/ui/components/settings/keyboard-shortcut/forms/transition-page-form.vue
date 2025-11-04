<template>
    <div class="form-group">
        <label>遷移URL:</label>
        <input v-model="formData.transitionUrl" type="text" placeholder="/jackpot-game" />
    </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

interface Props {
    initialData: { transitionUrl?: string };
}

const props = defineProps<Props>();
const emit = defineEmits<{ save: [data: any] }>();

const formData = reactive({
    transitionUrl: props.initialData.transitionUrl || '',
});

const save = () => {
    emit('save', { actionType: 'TransitionPageEvent', ...formData });
};

defineExpose({ save });
</script>