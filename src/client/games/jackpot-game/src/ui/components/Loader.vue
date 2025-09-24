<template>
  <div class="jp-loader">
    <span class="jp-loader-spinner"></span>
    <span class="jp-loader-text">Loading...</span>
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
  padding: 18px;
  font-size: 1.2em;
  color: #b8c0ff;
}
.jp-loader-spinner {
  width: 28px;
  height: 28px;
  border: 4px solid #ffe5ec;
  border-top: 4px solid #b8c0ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 12px;
}
.jp-loader-text {
  font-family: 'Montserrat', 'Arial', sans-serif;
  font-weight: 700;
  font-size: 1.1em;
  color: #fcd5ce;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
