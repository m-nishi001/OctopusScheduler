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
  background: #000;
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
  /* MainLayoutは画面(ルート)ごとに新しいインスタンスとしてmountされるため、
     このCSSアニメーションだけで「画面遷移のたびにふわっと表示される」
     フェードインが実現できる(Vue<Transition>のような単一ルート制約も不要)。 */
  animation: jp-screen-fade-in 320ms ease-out;
}

@keyframes jp-screen-fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  main {
    animation: none;
  }
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
