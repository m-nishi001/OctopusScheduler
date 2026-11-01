<template>
  <div class="media-picker" data-testid="media-picker">
    <label class="field-label">{{ label }}</label>
    <div class="media-picker__body">
      <div class="media-picker__preview">
        <img v-if="kind === 'image' && previewUrl" :src="previewUrl" :alt="label" class="media-picker__image" />
        <audio v-else-if="kind === 'audio' && previewUrl" :src="previewUrl" controls class="media-picker__audio"></audio>
        <span v-else class="media-picker__empty">{{ label }}なし</span>
      </div>
      <div class="media-picker__controls">
        <input type="file" :accept="kind === 'image' ? 'image/*' : 'audio/*'" class="media-picker__file"
          data-testid="media-file" @change="onFile" />
        <select :value="modelValue" class="media-picker__select" data-testid="media-select" @change="onSelect">
          <option value="">登録済みの素材から選ぶ</option>
          <option v-for="name in options" :key="name" :value="name">{{ name }}</option>
        </select>
        <div class="media-picker__current">
          <span class="media-picker__name" data-testid="media-name">{{ modelValue || '未設定' }}</span>
          <UiButton v-if="modelValue" size="sm" variant="danger" data-testid="media-remove" @click="emit('update:modelValue', '')">外す</UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiButton } from '@octopus/ui-kit';
import type { MediaKind } from '@ui/composables/use-media-draft';

/**
 * 素材(画像・音声)を1つ選ぶ部品。景品のフォームも画面設定のフォームも、これだけを使う。
 * ファイルを選ぶ / このモジュールに登録済みの素材から選ぶ / プレビュー / 外す。値は素材の名前(空 = なし)。
 * ファイルを選ぶと、その名前を値にして `pick` で知らせる(保存は親が、名前とファイルをまとめて渡す)。
 */
defineProps<{
  label: string;
  kind: MediaKind;
  modelValue: string;
  /** 選べる登録済みの素材の名前。 */
  options: string[];
  /** プレビューの URL(空 = なし)。 */
  previewUrl: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [name: string];
  pick: [file: File];
}>();

const onFile = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  emit('pick', file);
  emit('update:modelValue', file.name);
  input.value = '';
};

const onSelect = (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value);
</script>

<style scoped>
.media-picker {
  min-width: 0;
}

.field-label {
  color: var(--ui-text, #fff);
  font-weight: 600;
  font-size: var(--ui-font-sm, 0.875rem);
}

.media-picker__body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-top: 6px;
}

.media-picker__preview {
  flex: 0 0 140px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-surface, #2b3036);
  border: 1px solid var(--ui-border, #3a4048);
  border-radius: 8px;
  padding: 6px;
  box-sizing: border-box;
}

.media-picker__image {
  max-width: 100%;
  max-height: 120px;
  object-fit: contain;
  border-radius: 6px;
}

.media-picker__audio {
  width: 100%;
  max-width: 128px;
}

.media-picker__empty {
  color: var(--ui-text-muted, #cfd6dd);
  font-size: var(--ui-font-sm, 0.875rem);
  text-align: center;
}

.media-picker__controls {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.media-picker__select,
.media-picker__file {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--ui-border, #3a4048);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: var(--ui-font-sm, 0.875rem);
  color: var(--ui-text, #fff);
}

.media-picker__current {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.media-picker__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text-muted, #cfd6dd);
  font-size: var(--ui-font-sm, 0.875rem);
}
</style>
