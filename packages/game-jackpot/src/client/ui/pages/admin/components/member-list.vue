<template>
  <div>
    <div v-if="members.length" class="list-controls">
      <label class="select-all-label">
        <input type="checkbox" :checked="isAllSelected" @change="onToggleAll" class="select-all-checkbox" />
        <span class="sr-only">全選択</span>
      </label>
    </div>

    <ul v-if="members.length" class="admin-list">
      <li v-for="member in members" :key="member.id" class="admin-list-item">
        <input type="checkbox" :value="member.id" :checked="selected.includes(member.id)"
          @change="onToggleOne(member.id)" />
        <div class="member-preview">
          <img v-if="member.photoAssetId || member.photoAsset" :src="getMemberImageSrc(member)" alt="photo"
            class="preview-img" />
          <span v-else>{{ member.name }}</span>
        </div>
        <div class="member-info">
          <span>{{ member.name }}</span>
        </div>
        <button class="admin-btn ml-2" @click="$emit('edit', member)">詳細</button>
        <button class="admin-btn ml-2 delete-btn" @click="$emit('delete', member.id)" title="このゲームから外す">外す</button>
      </li>
    </ul>
    <div v-else class="empty-state">
      メンバーはいません
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  members: { type: Array as () => any[], required: true },
  selected: { type: Array as () => string[], required: true },
  isAllSelected: { type: Boolean, required: true },
  getMemberImageSrc: { type: Function as unknown as () => (member: any) => string, required: true },
});

const emit = defineEmits<{
  edit: [member: any];
  delete: [id: string];
  'update:selected': [ids: string[]];
  'update:isAllSelected': [value: boolean];
}>();

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

.member-preview {
  width: 110px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a3137;
  border-radius: 6px;
  overflow: hidden;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  display: block;
}

.member-info {
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
  padding: 9px 18px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: 700;
  cursor: pointer;
  transition: box-shadow 0.18s, background 0.18s, transform 0.12s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.admin-btn:hover {
  box-shadow: 0 6px 18px rgba(79, 140, 255, 0.16);
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
