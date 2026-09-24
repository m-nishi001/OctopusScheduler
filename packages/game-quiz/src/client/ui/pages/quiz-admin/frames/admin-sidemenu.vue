<template>
    <aside class="admin-sidebar">
        <nav>
            <ul>
                <li>
                    <router-link to="/quiz-admin/quizzes" class="menu-link">
                        <span class="icon">📝</span>
                        <span class="label">クイズ一覧</span>
                    </router-link>
                </li>
                <li>
                    <router-link to="/quiz-admin/members" class="menu-link">
                        <span class="icon">👥</span>
                        <span class="label">メンバー管理</span>
                    </router-link>
                </li>
            </ul>
        </nav>
    </aside>
</template>

<script setup lang="ts">
</script>

<style scoped>
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
    color: #fff;
    text-decoration: none;
    font-weight: 700;
    border-radius: 6px;
    box-sizing: border-box;
}

.menu-link .icon {
    width: 28px;
    text-align: center;
}

.menu-link .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.menu-link:hover {
    background: rgba(255, 255, 255, 0.04);
}

.menu-link.router-link-active {
    background: rgba(79, 129, 255, 0.12);
    color: #7ecbff;
}

@media (max-width: 900px) {
    .admin-sidebar {
        width: 72px;
        padding: 18px 8px;
    }

    .menu-link .label {
        display: none;
    }
}
</style>
