<template>
  <AdminLayout />
</template>

<script lang="ts">
import AdminLayout from './admin-layout.vue';

export default {
  name: 'AdminView',
  components: { AdminLayout },
};
</script>

<style scoped>
/* 各セクションの余白は個別コンポーネントで管理 */
</style>
