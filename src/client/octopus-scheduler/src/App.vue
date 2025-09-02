<script setup lang="ts">
import { onMounted } from 'vue';
import { AudioRepository } from './infrastructures/assets/audio/audio-repository';
import { ImageRepository } from './infrastructures/assets/image/image-repository';
import { MovieRepository } from './infrastructures/assets/movie/movie-repository';

onMounted(async () => {
  // 各アセットの同期処理を一括実行
  const audioRepo = new AudioRepository();
  const imageRepo = new ImageRepository();
  const movieRepo = new MovieRepository();

  try {
    await Promise.all([
      audioRepo.sync(),
      imageRepo.sync(),
      movieRepo.sync(),
    ]);
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
