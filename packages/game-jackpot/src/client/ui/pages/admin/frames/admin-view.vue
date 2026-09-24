<template>
  <div class="admin-layout">
    <AdminHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <div class="admin-body">
      <div v-if="sidebarOpen" class="admin-backdrop" @click="sidebarOpen = false"></div>
      <AdminSidemenu :open="sidebarOpen" />
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AdminHeader from './admin-header.vue';
import AdminSidemenu from './admin-sidemenu.vue';

const sidebarOpen = ref(false);
const route = useRoute();
// 画面遷移したらモバイルのドロワーは自動で閉じる。
watch(() => route.path, () => { sidebarOpen.value = false; });
</script>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #23252b;
}

.admin-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.admin-content {
  flex: 1;
  padding: 20px 4vw;
  background: transparent;
  color: #fff;
  min-width: 0;
  overflow: auto;
  min-height: 0;
}

@media (max-width: 900px) {
  .admin-content {
    padding: 16px 2vw;
  }
}

.admin-backdrop {
  display: none;
}

@media (max-width: 860px) {
  .admin-backdrop {
    display: block;
    position: fixed;
    inset: 48px 0 0 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 390;
  }
}
</style>
