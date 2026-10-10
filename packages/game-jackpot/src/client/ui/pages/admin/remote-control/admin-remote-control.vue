<template>
  <div class="admin-section remote-control-page">
    <p class="hint">
      このページから、会場の本番スクリーン(演出画面)の画面遷移・進行操作を遠隔で行えます。
      演出画面側は数秒以内に操作を反映します。
    </p>

    <div class="current-status">
      <span class="status-label">現在の演出画面:</span>
      <span class="status-value">{{ currentScreenLabel }}</span>
    </div>

    <div class="screen-buttons">
      <button
        v-for="opt in screenOptions"
        :key="opt.key"
        type="button"
        class="screen-btn"
        :class="{ active: state?.screen === opt.key }"
        :disabled="sending"
        @click="goTo(opt.key)"
      >
        {{ opt.label }}
      </button>
    </div>

    <button
      type="button"
      class="advance-btn"
      :disabled="sending"
      @click="advance"
    >
      ▶ 次へ
    </button>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { container } from 'tsyringe';
import { usePolling } from '@octopus/composables';
import {
  RemoteControlRepository,
  type JackpotRemoteScreen,
  type RemoteControlState,
} from '@model/remote-control/remote-control-repository';

const POLL_INTERVAL_MS = 2000;

const screenOptions: { key: JackpotRemoteScreen; label: string }[] = [
  { key: 'opening', label: 'オープニング' },
  { key: 'description', label: '説明' },
  { key: 'demo', label: 'デモ抽選' },
  { key: 'main-draw', label: '本抽選' },
  { key: 'result', label: '最終結果' },
  { key: 'ending', label: 'エンディング' },
];

const repo = container.resolve(RemoteControlRepository);
const state = ref<RemoteControlState | null>(null);
const sending = ref(false);
const errorMessage = ref<string | null>(null);

const currentScreenLabel = computed(() => {
  const key = state.value?.screen;
  if (!key) return '(未設定)';
  return screenOptions.find((o) => o.key === key)?.label ?? key;
});

const { start, stop } = usePolling(
  async () => {
    try {
      state.value = await repo.getState();
    } catch {
      // 一時的なポーリング失敗は無視し、次回のポーリングに委ねる
    }
  },
  POLL_INTERVAL_MS,
  { immediate: true }
);
start();
onUnmounted(stop);

const goTo = async (screen: JackpotRemoteScreen) => {
  if (sending.value) return;
  sending.value = true;
  errorMessage.value = null;
  try {
    state.value = await repo.setScreen(screen);
  } catch (err) {
    console.error('Failed to set remote screen:', err);
    errorMessage.value = '画面遷移の送信に失敗しました。もう一度お試しください。';
  } finally {
    sending.value = false;
  }
};

const advance = async () => {
  if (sending.value) return;
  sending.value = true;
  errorMessage.value = null;
  try {
    state.value = await repo.advance();
  } catch (err) {
    console.error('Failed to send remote advance:', err);
    errorMessage.value = '進行操作の送信に失敗しました。もう一度お試しください。';
  } finally {
    sending.value = false;
  }
};
</script>

<style scoped>
.remote-control-page {
  color: var(--ui-text, #fff);
  padding: 16px;
  box-sizing: border-box;
  max-width: 640px;
}

.hint {
  color: var(--ui-text-muted, #cfd6dd);
  font-size: var(--ui-font-sm, 0.875rem);
  line-height: 1.5;
}

.current-status {
  background: var(--ui-surface, #2b3036);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 16px 0;
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
}

.status-label {
  color: var(--ui-text-muted, #cfd6dd);
  font-size: var(--ui-font-sm, 0.875rem);
}

.status-value {
  font-weight: bold;
  font-size: var(--ui-font-md, 1rem);
  color: #4ea1ff;
}

.screen-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.screen-btn {
  flex: 1 1 calc(50% - 10px);
  min-width: 120px;
  min-height: 56px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid var(--ui-border, #3a4048);
  background: var(--ui-surface, #2b3036);
  color: var(--ui-text, #fff);
  font-size: var(--ui-font-md, 1rem);
  font-weight: 600;
  cursor: pointer;
}

.screen-btn.active {
  background: #4f8cff;
  border-color: #4f8cff;
}

.screen-btn:disabled,
.advance-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.advance-btn {
  width: 100%;
  min-height: 64px;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(90deg, #6d28d9, #ec4899);
  color: var(--ui-text, #fff);
  font-size: var(--ui-font-lg, 1.2rem);
  font-weight: 800;
  cursor: pointer;
}

.error-message {
  margin-top: 16px;
  color: #ff6b6b;
  font-weight: 600;
}

@media (max-width: 640px) {
.screen-btn {
    flex: 1 1 100%;
  }
}
</style>
