<template>
  <div class="main-layout">
    <header>
      <h1>Jackpod 抽選アプリ</h1>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>

<script lang="ts">
export default {
  name: 'MainLayout',
};
</script>

<style scoped>
.main-layout {
  min-height: 100vh;
  background: #f5f5f5;
}
header {
  background: #1976d2;
  color: #fff;
  padding: 16px;
}
main {
  padding: 24px;
}
</style>
