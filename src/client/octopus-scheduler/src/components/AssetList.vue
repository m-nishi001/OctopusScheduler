<template>
  <div>
    <h3>{{ type }}アセット一覧</h3>
    <table>
      <thead>
        <tr>
          <th>名前</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="asset in assets" :key="asset.id">
          <td>{{ asset.name }}</td>
          <td>
            <button @click="$emit('edit', asset)">編集</button>
            <button @click="$emit('delete', asset)">削除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <button @click="$emit('add')">追加</button>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{ type: string; assets: { id: string; name: string }[] }>();
console.log('AssetList assets:', props.assets);
const emit = defineEmits(['add', 'edit', 'delete']);
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1em;
}

th,
td {
  border: 1px solid #ccc;
  padding: 0.5em;
}

button {
  margin-right: 0.5em;
}
</style>
