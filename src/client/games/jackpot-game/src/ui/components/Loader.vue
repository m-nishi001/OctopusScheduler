<template>
  <div class="jp-loader">
    <span>Loading...</span>
  </div>
</template>

<script lang="ts">
export default {
  name: 'Loader',
};
</script>

<style scoped>
.jp-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  font-size: 1.2em;
  color: #1976d2;
}
</style>
