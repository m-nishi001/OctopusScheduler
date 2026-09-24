<template>
  <div class="jp-loader" :class="{ overlay: fullScreen }">
    <span class="jp-loader-spinner"></span>
    <span v-if="label" class="jp-loader-text">{{ label }}</span>
  </div>
</template>

<script lang="ts">
export default {
  name: 'Loader',
  props: {
    /** trueの場合、画面全体を覆う半透明オーバーレイとして表示する。 */
    fullScreen: { type: Boolean, default: true },
    label: { type: String, default: '' },
  },
};
</script>

<style scoped>
.jp-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
}

.jp-loader.overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: radial-gradient(circle at 50% 30%, #1b0b05 0%, #0b0503 60%, #040203 100%);
}

.jp-loader-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 240, 217, 0.2);
  border-top: 4px solid #ffd36f;
  border-radius: 50%;
  animation: jp-loader-spin 0.9s linear infinite;
}

.jp-loader-text {
  font-weight: 700;
  font-size: 1.1em;
  letter-spacing: 0.04em;
  background: linear-gradient(90deg, #ffd36f, #ff7aa0);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

@keyframes jp-loader-spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
