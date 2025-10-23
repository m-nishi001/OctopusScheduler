<template>
  <aside class="admin-sidebar">
    <nav>
      <ul>
        <li>
          <router-link to="/jackpot-admin/members" class="menu-link">
            <span class="icon">👥</span>
            <span class="label">メンバー設定</span>
          </router-link>
        </li>

        <li>
          <router-link to="/jackpot-admin/prizes" class="menu-link">
            <span class="icon">🎁</span>
            <span class="label">景品設定</span>
          </router-link>
        </li>

        <li class="submenu">
          <div class="menu-link submenu-toggle" :class="{ 'parent-active': parentActive }" @click="toggleScreensSubmenu"
            role="button" tabindex="0" @keydown="onToggleKey">
            <span class="icon">🖥️</span>
            <span class="label">画面設定</span>
            <span class="arrow" :class="{ open: screensSubmenuOpen }">▶</span>
          </div>

          <ul v-show="screensSubmenuOpen" :class="['submenu-list', { open: screensSubmenuOpen }]">
            <li>
              <router-link to="/jackpot-admin/screens/home" class="submenu-link"
                :class="{ 'active-sub': isRouteActive('/jackpot-admin/screens/home') }">ホーム</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/opening" class="submenu-link"
                :class="{ 'active-sub': isRouteActive('/jackpot-admin/screens/opening') }">オープニング</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/description" class="submenu-link"
                :class="{ 'active-sub': isRouteActive('/jackpot-admin/screens/description') }">説明</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/demo" class="submenu-link"
                :class="{ 'active-sub': isRouteActive('/jackpot-admin/screens/demo') }">デモ抽選</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/main" class="submenu-link"
                :class="{ 'active-sub': isRouteActive('/jackpot-admin/screens/main') }">本抽選</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/result" class="submenu-link"
                :class="{ 'active-sub': isRouteActive('/jackpot-admin/screens/result') }">最終結果</router-link>
            </li>
            <li>
              <router-link to="/jackpot-admin/screens/ending" class="submenu-link"
                :class="{ 'active-sub': isRouteActive('/jackpot-admin/screens/ending') }">エンディング</router-link>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const screensSubmenuOpen = ref(false);
const route = useRoute();

const isScreensRoute = () => (route.path ?? '').startsWith('/jackpot-admin/screens');

onMounted(() => { screensSubmenuOpen.value = isScreensRoute(); });
watch(() => route.path, () => { screensSubmenuOpen.value = isScreensRoute(); });

const toggleScreensSubmenu = () => { screensSubmenuOpen.value = !screensSubmenuOpen.value; };
const parentActive = computed(() => isScreensRoute());
const onToggleKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleScreensSubmenu(); } };
const isRouteActive = (path: string) => {
  const p = route.path ?? '';
  return p === path || p.startsWith(path + '/') || p.startsWith(path + '?') || p.startsWith(path + '#');
};
</script>

<style scoped>
/* Sidebar container */
.admin-sidebar {
  width: 240px;
  background: #0f1112;
  color: #fff;
  padding: 18px 12px;
  box-sizing: border-box;
}

nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

nav>ul>li {
  position: relative;
  margin: 10px 0;
}

.menu-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  /* balanced padding */
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  border-radius: 6px;
  box-sizing: border-box;
}

.menu-link .icon {
  width: 28px;
  text-align: center
}

.menu-link .label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submenu {
  margin-top: 4px;
}

.submenu-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 16px;
  position: relative;
  border-radius: 8px;
  box-sizing: border-box;
  cursor: pointer
}

.submenu-toggle .label {
  flex: 1 1 auto;
  padding-right: 28px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submenu-toggle.parent-active {
  background: rgba(79, 129, 255, 0.06);
  overflow: hidden;
}

.arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%) rotate(0deg);
  transition: transform 0.18s ease;
}

.arrow.open {
  transform: translateY(-50%) rotate(90deg);
}

.submenu-list {
  list-style: none;
  margin: 4px 0 0 18px;
  padding: 4px 0 0 0;
  overflow: hidden
}

.submenu-list li {
  margin: 6px 0
}

.submenu-link {
  color: #4ea1ff;
  text-decoration: none;
  padding: 4px 8px;
  display: inline-block;
  border-radius: 4px
}

.submenu-link:hover {
  color: #7ecbff;
  background: rgba(126, 203, 255, 0.04);
}

.submenu-link.active-sub {
  color: #fff;
  font-weight: 800;
  background: rgba(79, 140, 255, 0.08);
  padding-left: 10px;
  border-left: 4px solid #4ea1ff;
  border-radius: 6px
}

/* Enhanced submenu visuals */
.submenu-toggle.parent-active {
  background: linear-gradient(180deg, rgba(125, 95, 255, 0.06) 0%, rgba(174, 225, 255, 0.02) 100%);
  color: #e9e9ff;
}

.submenu-list {
  list-style: none;
  padding: 6px;
  margin: 0 12px;
  background: rgba(58, 70, 96, 0.06);
  border-radius: 10px;
  margin-top: 8px;
  box-shadow: 0 6px 18px rgba(15, 22, 44, 0.12);
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.28s ease, padding 0.18s ease;
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
  background: rgba(79, 140, 255, 0.06);
  color: #ffffff;
}

.submenu-list.open {
  max-height: 420px;
  padding: 8px;
}
</style>
}
