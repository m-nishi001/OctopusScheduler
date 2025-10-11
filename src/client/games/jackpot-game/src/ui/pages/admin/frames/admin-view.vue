<template>
  <div class="admin-layout">
    <AdminHeader />
    <div class="admin-body">
      <AdminSidemenu />
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import AdminHeader from './admin-header.vue';
import AdminSidemenu from './admin-sidemenu.vue';
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
  min-height: 0;
}

.admin-content {
  flex: 1;
  padding: 24px 5vw;
  background: #232b36;
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
</style>
