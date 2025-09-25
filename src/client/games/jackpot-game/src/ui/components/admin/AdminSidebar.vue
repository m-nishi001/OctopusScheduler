<template>
  <aside class="admin-sidebar">
    <nav>
      <ul>
        <li>
          <router-link to="/jackpot-admin/members" class="menu-link">
            <span class="icon">👤</span> メンバー管理
          </router-link>
        </li>
        <li>
          <router-link to="/jackpot-admin/prizes" class="menu-link">
            <span class="icon">🎁</span> 景品管理
          </router-link>
        </li>
        <li>
          <router-link to="/jackpot-admin/screens" class="menu-link">
            <span class="icon">🖥️</span> 画面管理
          </router-link>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup lang="ts">
// サイドバーのロジック（必要に応じて拡張）
</script>

<style scoped>
.admin-sidebar {
  width: 200px;
  background: #263040;
  color: #fff;
  padding: 32px 0;
  min-height: 100vh;
  box-shadow: 2px 0 8px rgba(0,0,0,0.04);
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
.icon {
  font-size: 1.2em;
}
</style>
