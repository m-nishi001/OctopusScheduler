<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">デモ抽選画面</h2>
      <button @click="$router.push('/main-draw')"
        class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">本抽選へ</button>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import MainLayout from '../common/MainLayout.vue';
export default {
  name: 'DemoDraw',
  components: { MainLayout },
};
</script>
