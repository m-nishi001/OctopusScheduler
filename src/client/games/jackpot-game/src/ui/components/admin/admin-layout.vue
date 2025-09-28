<template>
  <div class="admin-layout">
    <AdminHeader />
    <div class="admin-body">
      <AdminSidebar />
      <main class="admin-content">
        <div class="admin-tabs">
          <button :class="{ active: activeTab === 'dashboard' }" @click="activeTab = 'dashboard'">
            ダッシュボード
          </button>
          <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">
            設定
          </button>
        </div>
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import AdminHeader from './admin-header.vue';
import AdminSidebar from './admin-sidebar.vue';
import { ref } from 'vue';
const activeTab = ref('dashboard');
</script>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #232b36;
}
.admin-body {
  display: flex;
  flex: 1;
}
.admin-content {
  flex: 1;
  padding: 24px 5vw;
  background: #232b36;
  color: #fff;
  min-width: 0;
}
@media (max-width: 900px) {
  .admin-content {
    padding: 16px 2vw;
  }
}
.admin-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}
.admin-tabs button {
  background: #232b36;
  color: #fff;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.admin-tabs button.active {
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: bold;
}
</style>
