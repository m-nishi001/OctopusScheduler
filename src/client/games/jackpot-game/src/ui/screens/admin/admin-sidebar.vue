<template>
  <aside class="admin-sidebar">
    <nav>
      <ul>
        <li>
          <router-link to="/jackpot-admin/assets" class="menu-link">
            <span class="icon">�</span> アセット管理
          </router-link>
        </li>
        <li>
          <router-link to="/jackpot-admin/members" class="menu-link">
            <span class="icon">👤</span> メンバー設定
          </router-link>
        </li>
        <li>
          <router-link to="/jackpot-admin/prizes" class="menu-link">
            <span class="icon">🎁</span> 景品設定
          </router-link>
        </li>
        <li class="submenu">
          <div class="menu-link submenu-toggle" @click="toggleScreensSubmenu">
            <span class="icon">🖥️</span> 画面設定
            <span class="arrow" :class="{ open: screensSubmenuOpen }">▶</span>
          </div>
          <ul v-if="screensSubmenuOpen" class="submenu-list">
            <li>
              <a href="#" class="submenu-link" @click="selectScreen('home')">ホーム</a>
            </li>
            <li>
              <a href="#" class="submenu-link" @click="selectScreen('opening')">オープニング</a>
            </li>
            <li>
              <a href="#" class="submenu-link" @click="selectScreen('description')">説明</a>
            </li>
            <li>
              <a href="#" class="submenu-link" @click="selectScreen('demo')">デモ抽選</a>
            </li>
            <li>
              <a href="#" class="submenu-link" @click="selectScreen('main')">本抽選</a>
            </li>
            <li>
              <a href="#" class="submenu-link" @click="selectScreen('result')">最終結果</a>
            </li>
            <li>
              <a href="#" class="submenu-link" @click="selectScreen('ending')">エンディング</a>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const screensSubmenuOpen = ref(false);

const toggleScreensSubmenu = () => {
  screensSubmenuOpen.value = !screensSubmenuOpen.value;
};

const selectScreen = (screenType: string) => {
  router.push(`/jackpot-admin/screens/${screenType}`);
};
</script>

<style scoped>
.admin-sidebar {
  width: 200px;
  background: #263040;
  color: #fff;
  padding: 32px 0;
  min-height: 100vh;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.admin-sidebar ul {
  list-style: none;
  padding: 0;
  width: 100%;
}

.admin-sidebar li {
  margin: 12px 0;
}

.menu-link {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  text-decoration: none;
  font-weight: 500;
  padding: 12px 24px;
  border-radius: 8px;
  transition: background 0.2s, color 0.2s;
}

.menu-link:hover {
  background: #3a4660;
  color: #aee1ff;
}

.router-link-active.menu-link {
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: bold;
}

.submenu {
  position: relative;
}

.submenu-toggle {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.arrow {
  transition: transform 0.2s;
}

.arrow.open {
  transform: rotate(90deg);
}

.submenu-list {
  list-style: none;
  padding: 0;
  margin: 0;
  background: #3a4660;
  border-radius: 8px;
  margin-top: 8px;
}

.submenu-list li {
  margin: 0;
}

.submenu-link {
  display: block;
  color: #fff;
  text-decoration: none;
  padding: 10px 24px 10px 40px;
  font-size: 0.9em;
  transition: background 0.2s;
}

.submenu-link:hover {
  background: #4f8cff;
}
</style>
