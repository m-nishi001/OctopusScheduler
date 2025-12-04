<template>
    <div>
        <label>フェードアウト時間 (秒)</label>
        <input type="number" v-model.number="local.fadeOutDuration" min="0" step="0.1" />
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { StopAudioFormData } from "../../app-events/types";

const props = defineProps<{ initialData?: StopAudioFormData }>();
const emit = defineEmits<{ save: [StopAudioFormData] }>();

const local = ref<StopAudioFormData>({
    actionType: "StopAudioEvent",
    fadeOutDuration: 0,
});

watch(
    () => props.initialData,
    (v) => {
        if (v) local.value = { ...local.value, ...v } as StopAudioFormData;
    },
    { immediate: true }
);

function save() {
    emit("save", local.value);
}

function reset() {
    local.value = ({ actionType: "StopAudioEvent", fadeOutDuration: 0 } as StopAudioFormData);
    if (props.initialData) {
        local.value = { ...local.value, ...props.initialData } as StopAudioFormData;
    }
}

defineExpose({ save, reset });
</script>

<style scoped>
label {
    display: block;
    margin-bottom: 6px;
    color: #fff
}

input {
    width: 100%;
    padding: 6px;
    border-radius: 6px;
    border: 1px solid #666;
    background: #333;
    color: #fff
}
</style>
