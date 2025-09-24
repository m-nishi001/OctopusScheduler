<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">オープニング</h2>
      <button @click="$router.push('/description')"
        class="bg-gradient-to-r from-indigo-400 to-purple-400 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">次へ</button>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import MainLayout from './MainLayout.vue';
export default {
  name: 'Opening',
  components: { MainLayout },
};
</script>
