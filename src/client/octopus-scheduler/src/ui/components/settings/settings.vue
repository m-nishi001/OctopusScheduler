<template>
  <div class="admin-layout">
    <AdminHeader />
    <div class="admin-body">
      <AdminSidemenu :currentTab="currentTab" @tabChange="currentTab = $event" />
      <main class="admin-content">
        <EventEditor v-if="currentTab === 'events'" />
        <AssetListEditor v-else-if="currentTab === 'assets'" />
        <KeyboardShortcutEditor v-else-if="currentTab === 'keyboard-shortcuts'" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AdminHeader from './frames/admin-header.vue';
import AdminSidemenu from './frames/admin-sidemenu.vue';
import EventEditor from './event-list/event-list.vue';
import AssetListEditor from './asset-list/asset-list-editor.vue';
import KeyboardShortcutEditor from './keyboard-shortcut/keyboard-shortcut-editor.vue';

const currentTab = ref('events');
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
