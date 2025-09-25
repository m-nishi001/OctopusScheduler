<template>
  <div class="admin-section">
    <h2>画面管理</h2>
    <form class="admin-form">
      <input type="text" placeholder="画面名" class="admin-input" />
      <button type="submit" class="admin-btn">保存</button>
    </form>
    <ul class="admin-list">
      <li class="admin-list-item">サンプル画面</li>
    </ul>
  </div>
</template>
<script setup lang="ts">
// 画面管理ロジック（必要に応じて拡張）
</script>

<style scoped>
.admin-section {
  margin-bottom: 32px;
}
.admin-form {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.admin-input {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.admin-input:focus {
  outline: 2px solid #4f8cff;
}
.admin-btn {
  padding: 10px 24px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}
.admin-btn:hover {
  background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}
.admin-list {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.admin-list-item {
  background: #232b36;
  color: #fff;
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
</style>
