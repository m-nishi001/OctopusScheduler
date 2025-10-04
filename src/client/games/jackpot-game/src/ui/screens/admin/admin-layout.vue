<template>
  <div class="admin-layout">
    <AdminHeader />
    <div class="admin-body">
      <AdminSidebar />
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import AdminHeader from './admin-header.vue';
import AdminSidebar from './admin-sidebar.vue';
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
</style>
