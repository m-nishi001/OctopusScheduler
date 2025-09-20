<template>
  <div class="settings dark-bg">
    <div class="settings-content">
      <div class="nav-group">
        <button class="main-btn nav-btn" @click="goHome">
          <span class="btn-icon">🏠</span> ホームへ
        </button>
      </div>
      <h2 class="settings-title">
        <span class="settings-icon">⚙️</span> 設定画面
      </h2>
      <div class="btn-group">
        <button class="main-btn" @click="goToAssets">
          <span class="btn-icon">🗂️</span> アセット編集
        </button>
        <button class="main-btn" @click="goToEvents">
          <span class="btn-icon">📅</span> イベント編集
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
const goToAssets = () => router.push({ name: 'asset-list-editor' });
const goToEvents = () => router.push({ name: 'event-editor' });
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

.settings-content {
  width: 100vw;
  height: 100vh;
  padding: 2em;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  /* ベース層の背景・枠装飾を削除 */
}

.nav-group {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 1em;
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
  margin-right: 1em;
  display: flex;
  align-items: center;
  gap: 0.7em;
}

.settings-title {
  font-size: 2em;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-bottom: 2em;
  display: flex;
  align-items: center;
  gap: 0.5em;
  color: #fff;
  text-shadow: 0 2px 12px #000a;
}

.settings-icon {
  font-size: 1.3em;
}

.btn-group {
  display: flex;
  gap: 1.5em;
  margin-bottom: 2em;
  width: 100%;
  justify-content: center;
}

.main-btn {
  font-size: 1.1em;
  font-weight: 600;
  padding: 0.9em 2.2em;
  background: linear-gradient(90deg, #222 0%, #2a2a2a 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
  outline: none;
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7em;
}

.main-btn .btn-icon {
  font-size: 1.2em;
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
  .settings-content {
    width: 100vw;
    height: 100vh;
    padding: 0.5em;
  }

  .settings-title {
    font-size: 1.3em;
  }

  .main-btn {
    font-size: 1em;
    padding: 0.7em 1.2em;
  }

  .nav-btn {
    font-size: 0.95em;
    padding: 0.6em 1em;
  }
}
</style>
