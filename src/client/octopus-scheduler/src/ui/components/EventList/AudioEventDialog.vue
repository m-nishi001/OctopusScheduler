<template>
  <div v-if="event">
    <h3>Audioイベント編集</h3>
    <div>名前: {{ event.name }}</div>
    <div>アセット: {{ event.assetName }}</div>
    <!-- 編集フォームを必要に応じて追加 -->
    <button @click="$emit('close')">閉じる</button>
  </div>
</template>
<script setup lang="ts">
defineProps<{ event: any }>();
defineEmits(['close']);
</script>
