<template>
  <div>
    <h1>Octopus Scheduler ホーム</h1>
    <div style="margin: 2em 0;">
      <router-link to="/assets">
        <button>アセット編集画面へ</button>
      </router-link>
      <router-link to="/events" style="margin-left: 1em;">
        <button>イベント編集画面へ</button>
      </router-link>
    </div>
    <p>ここにロード画面や初期同期処理を追加予定。</p>
  </div>
</template>

<script setup lang="ts">
// 今後ロード画面や同期処理を追加
</script>

<style scoped>
button {
  font-size: 1.1em;
  padding: 0.5em 1.5em;
}
</style>
