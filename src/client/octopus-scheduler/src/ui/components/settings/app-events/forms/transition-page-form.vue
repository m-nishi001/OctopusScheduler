<template>
    <div class="form-group">
        <label>遷移URL:</label>
        <input v-model="formData.transitionUrl" type="text" placeholder="/jackpot-game" />
    </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import type { TransitionPageFormData, EditTransitionPageFormData } from '../types';

type Props = {
    initialData?: TransitionPageFormData | EditTransitionPageFormData;
};

const props = defineProps<Props>();
const emit = defineEmits<{ save: [TransitionPageFormData | EditTransitionPageFormData] }>();

const formData = reactive({
    transitionUrl: props.initialData?.transitionUrl ?? '',
});

const save = () => {
    const base: TransitionPageFormData = { actionType: 'TransitionPageEvent', transitionUrl: formData.transitionUrl };
    if (props.initialData && 'eventId' in props.initialData) {
        // emit edit variant including eventId
        const out: EditTransitionPageFormData = { ...(base as any), eventId: (props.initialData as EditTransitionPageFormData).eventId };
        emit('save', out);
    } else {
        emit('save', base);
    }
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