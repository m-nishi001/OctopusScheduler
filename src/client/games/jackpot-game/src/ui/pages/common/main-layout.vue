<template>
  <div class="main-layout">
    <main :class="{ 'full-screen': fullScreen }">
      <slot />
    </main>
  </div>
</template>

<script lang="ts">
export default {
  name: 'MainLayout',
  props: {
    fullScreen: { type: Boolean, default: false },
  },
};
</script>

<style scoped>
.main-layout {
  min-height: 100vh;
  background: radial-gradient(circle at 10% 10%, #fff5f7 0%, transparent 30%),
    radial-gradient(circle at 90% 90%, #f3f0ff 0%, transparent 30%),
    linear-gradient(135deg, #fff0f6 0%, #f6f0ff 50%, #eef7ff 100%);
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
  
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #3b2f3f;
}


main.full-screen {
  padding: 0;
  align-items: stretch;
  justify-content: center;
}

/* if the global jackpot-fullscreen is active, force layout to be full-bleed and hide background */
:global(html.jackpot-fullscreen) .main-layout,
:global(body.jackpot-fullscreen) .main-layout {
  min-height: 100vh;
  background: transparent !important;
}

:global(html.jackpot-fullscreen) main,
:global(body.jackpot-fullscreen) main {
  padding: 0 !important;
  width: 100vw !important;
  max-width: 100vw !important;
}
</style>
