<template>
  <div class="panel">
    <h1 class="title">2025年度 ジャックポッド大会！</h1>
    <button @click="$router.push('/opening')">スタート</button>
    <button @click="$router.push('/admin')">管理画面</button>
  </div>
</template>
<script lang="ts">
export default {
  name: 'Home',
};
</script>
<style scoped>
.panel { text-align: center; }
.title { font-size: 2rem; margin-bottom: 2rem; }
</style>
