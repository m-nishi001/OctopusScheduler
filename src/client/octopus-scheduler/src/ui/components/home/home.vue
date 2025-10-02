<template>
  <div class="home dark-bg">
    <div class="home-content">
      <h1 class="home-title">
        <span class="octo-icon">🐙</span> Octopus Scheduler
      </h1>
      <div class="btn-group">
        <button class="main-btn" @click="goToAutonomous">
          <span class="btn-icon">🚀</span> 自立モード開始
        </button>
        <button class="main-btn" @click="goToSettings">
          <span class="btn-icon">⚙️</span> 設定画面
        </button>
        <button class="main-btn" @click="goToJackpotGame">
          <span class="btn-icon">🎰</span> Jackpot Game
        </button>
      </div>
      <p class="desc">ここにロード画面や初期同期処理を追加予定。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
const goToAutonomous = () => router.push({ name: 'autonomous-mode' });
const goToSettings = () => router.push({ name: 'settings' });
const goToJackpotGame = () => router.push('/jackpot-home');
// 今後ロード画面や同期処理を追加
</script>

<style scoped>
.home {
  background: linear-gradient(135deg, #181818 0%, #222 100%);
  color: #fff;
  min-height: 100vh;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.home-content {
  width: 100vw;
  height: 100vh;
  padding: 2em;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.home-title {
  font-size: 2.2em;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-bottom: 2em;
  display: flex;
  align-items: center;
  gap: 0.5em;
  color: #fff;
  text-shadow: 0 2px 12px #000a;
}

.octo-icon {
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

.desc {
  color: #bbb;
  font-size: 1em;
  margin-top: 1em;
  text-align: center;
}

@media (max-width: 600px) {
  .home-content {
    width: 100vw;
    height: 100vh;
    padding: 0.5em;
  }

  .home-title {
    font-size: 1.3em;
  }

  .main-btn {
    font-size: 1em;
    padding: 0.7em 1.2em;
  }
}
</style>
