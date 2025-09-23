<template>
  <div class="panel">
    <h2>デモ抽選画面</h2>
    <button @click="$router.push('/main-draw')">本抽選へ</button>
  </div>
</template>
<script lang="ts">
export default {
  name: 'DemoDraw',
};
</script>
