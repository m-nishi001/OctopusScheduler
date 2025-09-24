<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">本抽選画面</h2>
      <button @click="$router.push('/result')"
        class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">結果へ</button>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import MainLayout from '../common/MainLayout.vue';
export default {
  name: 'MainDraw',
  components: { MainLayout },
};
</script>
