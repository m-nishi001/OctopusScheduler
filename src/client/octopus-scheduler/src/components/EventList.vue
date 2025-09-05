<template>
  <table>
    <thead>
      <tr>
        <th>名前</th>
        <th>種別</th>
        <th>アセット</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="event in events" :key="event.id">
        <td>{{ event.name }}</td>
        <td>{{ event.type }}</td>
        <td>{{ event.assetName }}</td>
        <td>
          <button @click="$emit('edit', event)">編集</button>
          <button @click="$emit('delete', event)">削除</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
defineProps<{ events: Array<{ id: string; name: string; type: string; assetName?: string }> }>();
defineEmits(['edit', 'delete']);
</script>
