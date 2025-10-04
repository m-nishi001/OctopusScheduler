<template>
  <div class="progress-bar">
    <div class="progress-bar__track">
      <div class="progress-bar__fill" :style="{ width: percent + '%' }"></div>
    </div>
    <span class="progress-bar__label">{{ label }}</span>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({
  name: 'ProgressBar',
  props: {
    percent: {
      type: Number,
      required: true,
      default: 0,
    },
    label: {
      type: String,
      default: 'ダウンロード進捗',
    },
  },
});
</script>
<style scoped>
.progress-bar {
  width: 100%;
  margin: 12px 0;
}
.progress-bar__track {
  width: 100%;
  height: 16px;
  background: #e0e7ff;
  border-radius: 8px;
  overflow: hidden;
}
.progress-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #f9a8d4 0%, #fef08a 100%);
  transition: width 0.5s cubic-bezier(.4,0,.2,1);
}
.progress-bar__label {
  display: block;
  text-align: right;
  font-size: 0.9em;
  color: #6366f1;
  margin-top: 2px;
}
</style>
