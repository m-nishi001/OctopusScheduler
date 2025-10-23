<template>
  <aside class="admin-sidebar">
    <nav>
      <ul>
        <li>
          <router-link to="/jackpot-admin/members" class="menu-link">
            <span class="icon">👥</span> メンバー設定
          </router-link>
        </li>
        <li>
          <router-link to="/jackpot-admin/prizes" class="menu-link">
            <span class="icon">🎁</span> 景品設定
          </router-link>
        </li>
        <li>
          <router-link to="/jackpot-admin/assets" class="menu-link">
            <span class="icon">📁</span> アセット管理
          </router-link>
        </li>
        <li class="submenu">
          <div class="menu-link submenu-toggle" @click="toggleScreensSubmenu">
            <span class="icon">🖥️</span>
            <span class="label">画面設定</span>
            <span class="arrow" :class="{ open: screensSubmenuOpen }">▶</span>
          </div>
          <ul v-show="screensSubmenuOpen" :class="['submenu-list', { open: screensSubmenuOpen }]">
            <li>
              <router-link to="/jackpot-admin/screens/home" class="submenu-link">ホーム</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/opening" class="submenu-link">オープニング</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/description" class="submenu-link">説明</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/demo" class="submenu-link">デモ抽選</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/main" class="submenu-link">本抽選</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/result" class="submenu-link">最終結果</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/ending" class="submenu-link">エンディング</router-link>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const screensSubmenuOpen = ref(false);

const toggleScreensSubmenu = () => {
  screensSubmenuOpen.value = !screensSubmenuOpen.value;
};
</script>

<style scoped>
.admin-sidebar {
  width: 220px;
  background: linear-gradient(180deg,#1f2328 0%, #222731 100%);
  color: #fff;
  padding: 18px 0;
  align-self: stretch;
  min-height: 0;
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
  gap: 10px;
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  padding: 12px 18px;
  border-radius: 12px;
  transition: background 0.18s ease, color 0.18s ease, transform 0.12s;
}

.menu-link .icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.menu-link .label {
  flex: 1 1 auto;
}

.menu-link:hover {
  background: #2f3b52;
  color: #bfe9ff;
}

.router-link-active.menu-link {
  background: linear-gradient(180deg, rgba(125, 95, 255, 0.18) 0%, rgba(174, 225, 255, 0.08) 100%);
  color: #e9e9ff;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
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
  padding: 6px;
  margin: 0 12px;
  background: rgba(58, 70, 96, 0.14);
  border-radius: 10px;
  margin-top: 8px;
  box-shadow: 0 6px 18px rgba(15, 22, 44, 0.28);
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.28s ease, padding 0.18s ease;
}

.submenu-list li {
  margin: 0;
}

.submenu-link {
  display: block;
  color: #eaf6ff;
  text-decoration: none;
  padding: 10px 20px 10px 36px;
  font-size: 0.95em;
  transition: background 0.18s ease, color 0.18s ease;
  border-radius: 8px;
}

.submenu-link:hover {
  background: rgba(79, 140, 255, 0.12);
  color: #ffffff;
}

.submenu-list.open {
  /* allow room for the items - big enough for this menu */
  max-height: 420px;
  padding: 8px;
}
</style>
