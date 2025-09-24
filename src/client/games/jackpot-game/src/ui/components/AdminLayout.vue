<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 flex flex-col">
    <header class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg py-4 px-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-white tracking-wide drop-shadow">Jackpot 管理画面</h1>
      <div class="flex gap-2">
        <!-- 例: 管理用ボタンやナビゲーションを追加可能 -->
        <button class="bg-white text-indigo-600 font-semibold px-4 py-2 rounded shadow hover:bg-indigo-50 transition">ダッシュボード</button>
        <button class="bg-white text-pink-600 font-semibold px-4 py-2 rounded shadow hover:bg-pink-50 transition">設定</button>
      </div>
    </header>
    <main class="flex-1 flex flex-col items-center justify-center p-8">
      <div class="w-full max-w-4xl bg-white rounded-xl shadow-lg p-8">
        <slot />
      </div>
    </main>
    <footer class="bg-gray-100 text-gray-500 text-center py-3 text-xs mt-auto border-t">&copy; 2025 Jackpot Admin</footer>
  </div>
</template>

<script lang="ts">
export default {
  name: 'AdminLayout',
};
</script>

<style scoped>

</style>
