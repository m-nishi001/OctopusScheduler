<template>
    <div class="form-group">
        <label>遷移URL:</label>
        <input v-model="formData.transitionUrl" type="text" list="transition-url-presets" placeholder="/quiz-admin" />
        <datalist id="transition-url-presets">
            <option v-for="p in TRANSITION_URL_PRESETS" :key="p.value" :value="p.value">{{ p.label }}</option>
        </datalist>
        <small>実行画面を切り替える先のパスです。クイズは /quiz/クイズID/intro の形式です。</small>
    </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { TRANSITION_URL_PRESETS } from '../../../help/help-content';
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
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 4px;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
}
</style>
