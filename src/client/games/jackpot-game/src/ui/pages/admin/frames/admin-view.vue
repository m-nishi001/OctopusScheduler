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
import { onMounted, onUnmounted } from 'vue';
import AdminHeader from './admin-header.vue';
import AdminSidemenu from './admin-sidemenu.vue';

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
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
</style>
