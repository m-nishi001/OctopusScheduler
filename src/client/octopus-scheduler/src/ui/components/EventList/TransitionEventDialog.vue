<template>
  <div v-if="event">
    <h3>Transitionイベント編集</h3>
    <div>名前: {{ event.name }}</div>
    <!-- TransitionEventはアセット不要 -->
    <button @click="$emit('close')">閉じる</button>
  </div>
</template>
<script setup lang="ts">
defineProps<{ event: any }>();
defineEmits(['close']);
</script>
