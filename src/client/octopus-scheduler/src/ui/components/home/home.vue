
<template>
  <div class="home dark-bg">
    <h1>Octopus Scheduler ホーム</h1>
    <div class="btn-group">
      <button @click="goToAutonomous">自立モード開始</button>
      <button @click="goToSettings">設定画面</button>
    </div>
    <p>ここにロード画面や初期同期処理を追加予定。</p>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
const goToAutonomous = () => router.push({ name: 'autonomous-mode' });
const goToSettings = () => router.push({ name: 'settings' });
// 今後ロード画面や同期処理を追加
</script>

<style scoped>
.home {
  background: #222;
  color: #fff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.btn-group {
  display: flex;
  gap: 2rem;
  margin: 2em 0;
}
button {
  font-size: 1.1em;
  padding: 0.8em 2em;
  background: #333;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  transition: background 0.2s;
}
button:hover {
  background: #444;
}
</style>
