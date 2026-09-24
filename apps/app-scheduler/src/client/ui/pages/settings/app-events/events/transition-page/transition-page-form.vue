<template>
    <div class="form-group">
        <label>遷移URL:</label>
        <input v-model="formData.transitionUrl" type="text" placeholder="/jackpot-game" />
    </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { TransitionPageEventDto } from '../../../../../../control/app-event/dto/app-event-dto';

type Props = {
    initialData?: TransitionPageEventDto;
};

const props = defineProps<Props>();
const emit = defineEmits<{ save: [TransitionPageEventDto] }>();

const formData = reactive({
    transitionUrl: props.initialData?.transitionUrl ?? '',
});

const save = () => {
    const base: TransitionPageEventDto = { actionType: 'TransitionPageEvent', transitionUrl: formData.transitionUrl };
    if (props.initialData?.id) {
        emit('save', { ...base, id: props.initialData.id });
    } else {
        emit('save', base);
    }
};

const reset = () => {
    formData.transitionUrl = props.initialData?.transitionUrl ?? '';
};

// auto-reset when initialData changes
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
