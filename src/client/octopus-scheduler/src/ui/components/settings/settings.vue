<template>
  <div class="settings dark-bg">
    <header class="settings-header">
      <h1 class="settings-title">
        <span class="settings-icon">⚙️</span> 設定画面
      </h1>
      <button class="main-btn nav-btn" @click="goHome">
        <span class="btn-icon">🏠</span> ホームへ
      </button>
    </header>
    <div class="settings-main">
      <aside class="settings-sidebar">
        <nav class="sidebar-nav">
          <button class="sidebar-btn" :class="{ active: currentTab === 'events' }" @click="currentTab = 'events'">
            <span class="btn-icon">�</span> イベント管理
          </button>
          <button class="sidebar-btn" :class="{ active: currentTab === 'assets' }" @click="currentTab = 'assets'">
            <span class="btn-icon">�️</span> アセット管理
          </button>
        </nav>
      </aside>
      <main class="settings-content">
        <EventEditor v-if="currentTab === 'events'" />
        <AssetListEditor v-else />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import EventEditor from './event-list/event-editor.vue';
import AssetListEditor from './asset-list/asset-list-editor.vue';

const router = useRouter();
const currentTab = ref('events');

const goHome = () => router.push({ name: 'home' });
</script>

<style scoped>
.settings {
  background: linear-gradient(135deg, #181818 0%, #222 100%);
  color: #fff;
  min-height: 100vh;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1em 2em;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-title {
  font-size: 1.5em;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5em;
  color: #fff;
  text-shadow: 0 2px 12px #000a;
}

.settings-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-sidebar {
  width: 250px;
  background: rgba(0, 0, 0, 0.3);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1em 0;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
}

.sidebar-btn {
  background: none;
  border: none;
  color: #fff;
  padding: 1em 2em;
  text-align: left;
  cursor: pointer;
  font-size: 1em;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.7em;
  transition: background 0.2s;
}

.sidebar-btn:hover,
.sidebar-btn.active {
  background: rgba(255, 255, 255, 0.1);
}

.settings-content {
  flex: 1;
  padding: 0;
  overflow: auto;
}

.nav-btn {
  background: linear-gradient(90deg, #222 0%, #2a2a2a 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  font-size: 1em;
  font-weight: 600;
  padding: 0.7em 1.8em;
  display: flex;
  align-items: center;
  gap: 0.7em;
}

.main-btn:hover,
.main-btn:focus {
  background: linear-gradient(90deg, #2a2a2a 0%, #333 100%);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  transform: translateY(-2px) scale(1.04);
}

.main-btn:active {
  background: #1a1a1a;
  transform: scale(0.98);
}

@media (max-width: 600px) {
  .settings-main {
    flex-direction: column;
  }

  .settings-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
  }

  .sidebar-btn {
    flex-shrink:0;
    padding: 0.7em 1em;
  }

  .settings-title {
    font-size: 1.3em;
  }

  .nav-btn {
    font-size: 0.95em;
    padding: 0.6em 1em;
  }
}
</style>
