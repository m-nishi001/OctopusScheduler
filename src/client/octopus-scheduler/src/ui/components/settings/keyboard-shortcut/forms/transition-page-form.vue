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