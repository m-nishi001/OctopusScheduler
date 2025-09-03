<template>
  <div v-if="visible" class="dialog-backdrop">
    <div class="dialog">
      <h3>{{ type }}アセット追加</h3>
      <form @submit.prevent="submit">
        <label>
          名前：<input v-model="name" required />
        </label>
        <label v-if="type !== 'Image'">
          ファイル：<input type="file" @change="onFileChange" required />
        </label>
        <label v-else>
          画像：<input type="file" accept="image/*" @change="onFileChange" required />
        </label>
        <div style="margin-top:1em;">
          <button type="submit">追加</button>
          <button type="button" @click="$emit('close')">キャンセル</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';

defineProps<{ visible: boolean; type: 'Audio' | 'Image' | 'Movie' }>();
const emit = defineEmits(['submit', 'close']);

const name = ref('');
const file = ref<File | null>(null);

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    file.value = target.files[0];
  }
}

function submit() {
  if (!name.value || !file.value) return;
  emit('submit', { name: name.value, file: file.value });
  name.value = '';
  file.value = null;
}
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #fff;
  padding: 2em;
  border-radius: 8px;
  min-width: 300px;
}
</style>
