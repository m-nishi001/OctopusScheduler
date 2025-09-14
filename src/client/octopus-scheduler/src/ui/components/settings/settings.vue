<template>
  <div class="settings dark-bg">
    <h2>設定画面</h2>
    <v-btn @click="goToAssets">アセット編集</v-btn>
    <v-btn @click="goToEvents">イベント編集</v-btn>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
const goToAssets = () => router.push({ name: 'asset-list-editor' });
const goToEvents = () => router.push({ name: 'event-editor' });
</script>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  background: #222;
  color: #fff;
  min-height: 100vh;
  justify-content: center;
}
</style>
