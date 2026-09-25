<template>
  <div>
    <div v-if="prizes.length" class="list-controls">
      <label class="select-all-label">
        <input type="checkbox" :checked="isAllSelected" @change="onToggleAll" class="select-all-checkbox" />
        <span class="sr-only">全選択</span>
      </label>
    </div>

    <ul v-if="prizes.length" class="admin-list">
      <li v-for="prize in prizes" :key="prize.id" class="admin-list-item">
        <input type="checkbox" :value="prize.id" :checked="selected.includes(prize.id)"
          @change="onToggleOne(prize.id)" />
        <div class="prize-preview four-image">
          <template
            v-if="prize.imageAssetId || prize.image2AssetId || prize.winningImage1AssetId || prize.winningImage2AssetId">
            <div class="preview-half">
              <img v-if="prize.imageAssetId" :src="objectUrlMap.get(prize.imageAssetId) || prize.imageAssetId"
                alt="image1" class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">画像1なし</div>
            </div>
            <div class="preview-half">
              <img v-if="prize.image2AssetId" :src="objectUrlMap.get(prize.image2AssetId) || prize.image2AssetId"
                alt="image2" class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">画像2なし</div>
            </div>
            <div class="preview-half">
              <img v-if="prize.winningImage1AssetId"
                :src="objectUrlMap.get(prize.winningImage1AssetId) || prize.winningImage1AssetId" alt="winning1"
                class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">当選1なし</div>
            </div>
            <div class="preview-half">
              <img v-if="prize.winningImage2AssetId"
                :src="objectUrlMap.get(prize.winningImage2AssetId) || prize.winningImage2AssetId" alt="winning2"
                class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">当選2なし</div>
            </div>
          </template>
          <template v-else>
            <span>{{ prize.name }}</span>
          </template>
        </div>
        <div class="prize-info">
          <span>{{ prize.name }}</span>
        </div>
        <button class="admin-btn ml-2" @click="$emit('edit', prize)">詳細</button>
        <button class="admin-btn ml-2 delete-btn" @click="$emit('delete', prize.id)">削除</button>
      </li>
    </ul>
    <div v-else class="empty-state">
      景品はありません
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  prizes: { type: Array as () => any[], required: true },
  selected: { type: Array as () => string[], required: true },
  isAllSelected: { type: Boolean, required: true },
  objectUrlMap: { type: Object as () => Map<string, string>, required: true },
});

const emit = defineEmits<{
  edit: [prize: any];
  delete: [id: string];
  'update:selected': [ids: string[]];
  'update:isAllSelected': [value: boolean];
}>();

const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjNTU1Ii8+Cjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjY2NjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
  img.alt = 'No Image';
};

const onToggleAll = (e: Event) => {
  emit('update:isAllSelected', (e.target as HTMLInputElement).checked);
};

const onToggleOne = (id: string) => {
  const next = props.selected.includes(id)
    ? props.selected.filter((sid) => sid !== id)
    : [...props.selected, id];
  emit('update:selected', next);
};
</script>

<style scoped>
.list-controls {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.select-all-checkbox {
  width: 20px;
  height: 20px;
  margin: 0;
  vertical-align: middle;
}

.select-all-label {
  margin-left: 10px;
}

.admin-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.admin-list-item {
  background: #232b36;
  color: #fff;
  padding: 14px;
  border-radius: 10px;
  margin-bottom: 12px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
  display: grid;
  grid-template-columns: 36px 110px 1fr auto auto;
  gap: 14px;
  align-items: center;
}

.admin-list-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  justify-self: center;
}

.prize-preview {
  width: 110px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a3137;
  border-radius: 6px;
  overflow: hidden;
}

.prize-preview.four-image {
  display: flex;
  padding: 0;
}

.four-image .preview-half {
  width: 25%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: transparent;
}

.four-image .preview-half .preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder.small {
  font-size: 0.82rem;
  color: #9fb8db;
  padding: 6px;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  display: block;
}

.prize-info {
  min-width: 0;
}

.ml-2 {
  margin-left: 8px;
}

.empty-state {
  text-align: center;
  color: #c9d7e6;
  font-size: 1.1rem;
  padding: 40px;
}

.admin-btn {
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(79, 140, 255, 0.2);
}

.admin-btn:hover {
  box-shadow: 0 8px 20px rgba(79, 140, 255, 0.3);
  transform: translateY(-2px);
}

.delete-btn {
  background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%);
}

.delete-btn:hover {
  box-shadow: 0 6px 18px rgba(255, 107, 107, 0.14);
}

.sr-only {
  position: absolute !important;
  height: 1px;
  width: 1px;
  overflow: hidden;
  clip: rect(1px, 1px, 1px, 1px);
  white-space: nowrap;
  border: 0;
  padding: 0;
  margin: -1px;
}
</style>
