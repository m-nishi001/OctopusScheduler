<template>
  <div class="admin-layout">
    <header>
      <h1>Jackpod 管理画面</h1>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>

<script lang="ts">
export default {
  name: 'AdminLayout',
};
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  background: #fffbe6;
}
header {
  background: #ffa726;
  color: #fff;
  padding: 16px;
}
main {
  padding: 24px;
}
</style>
