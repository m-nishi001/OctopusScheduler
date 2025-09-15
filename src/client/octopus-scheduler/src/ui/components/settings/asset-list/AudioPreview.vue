<template>
  <div style="display:flex;flex-direction:column;align-items:center;">
    <button class="main-btn" @click="onPlay" :disabled="isLoading || isPlaying">
      ▶️ 再生
    </button>
    <button class="main-btn" @click="onPause" :disabled="!isPlaying">
      ⏸️ 一時停止
    </button>
    <button class="main-btn" @click="onStop" :disabled="!isPlaying">
      ⏹️ 停止
    </button>
    <div v-if="isLoading" style="margin-top:1em;color:#8fd3ff;">ロード中...</div>
    <div v-if="error" style="margin-top:1em;color:#ff8f8f;">{{ error.message }}</div>
    <div v-if="duration > 0" style="margin-top:1em;">
      <span>{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAudio } from '../../../../../../packages/shared-composables/src/use-audio';
import { defineProps } from 'vue';
import type { Asset } from 'src/model/domains/assets/entity/assset';
const props = defineProps<{ asset: Asset }>();

const { load, play, pause, stop, isLoading, isPlaying, currentTime, duration, error } = useAudio();

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

onMounted(async () => {
  if (props.asset.assetData) {
    await load(props.asset.assetData);
  }
});

function onPlay() { play(); }
function onPause() { pause(); }
function onStop() { stop(); }
</script>

<style scoped>
.main-btn {
  font-size: 1em;
  padding: 0.5em 1.2em;
  margin: 0.3em;
  background: #222;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.main-btn:disabled {
  background: #444;
  color: #aaa;
  cursor: not-allowed;
}
</style>
