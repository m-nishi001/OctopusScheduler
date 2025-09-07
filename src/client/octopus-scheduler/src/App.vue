<script setup lang="ts">
import { onMounted } from 'vue';
import { AssetSyncService } from './model/applications/assets/asset-sync-service';

onMounted(async () => {
  // クリーンアーキテクチャに従い、アプリケーションサービス経由で同期処理を実行
  const assetSyncService = new AssetSyncService();
  try {
    await assetSyncService.syncAll();
    console.log('全アセットの同期が完了しました');
  } catch (e) {
    console.error('アセット同期中にエラーが発生しました', e);
  }
});
</script>

<template>
  <div>
    <!-- <a href="https://vite.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a> -->
  </div>
  <!-- <HelloWorld msg="Vite + Vue" /> -->
  <router-view />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
