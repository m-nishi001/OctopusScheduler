<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h1 class="text-3xl font-bold text-indigo-700 mb-6 drop-shadow">2025年度 ジャックポッド大会！</h1>
      <div class="flex flex-col gap-4 items-center">
        <button @click="$router.push('/jackpot-opening')"
          class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">スタート</button>
        <button @click="$router.push('/jackpot-admin')"
          class="bg-gradient-to-r from-indigo-400 to-purple-400 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">管理画面</button>
      </div>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import MainLayout from './MainLayout.vue';
export default {
  name: 'Home',
  components: { MainLayout },
};
</script>
<style scoped>

</style>
