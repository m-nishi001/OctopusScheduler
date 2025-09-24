<template>
  <div class="main-layout">
    <header>
      <h1>jackpot 抽選アプリ</h1>
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
  background: linear-gradient(135deg, #ffe5ec 0%, #b8c0ff 100%);
  display: flex;
  flex-direction: column;
}
header {
  background: #fcd5ce;
  color: #6d6875;
  padding: 14px 0 10px 0;
  box-shadow: 0 2px 12px rgba(184,192,255,0.18);
  text-align: center;
  font-size: 1.5em;
  letter-spacing: 0.08em;
  font-family: 'Montserrat', 'Arial', sans-serif;
  text-shadow: 0 1px 4px #b8c0ff;
  border-bottom: 2px solid #b8c0ff;
}
main {
  flex: 1;
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
