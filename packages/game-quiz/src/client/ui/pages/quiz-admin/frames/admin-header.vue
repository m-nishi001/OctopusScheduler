<template>
    <header class="admin-header">
        <h1 class="admin-title">クイズ管理</h1>
        <router-link to="/home" class="home-button" aria-label="ホームへ戻る">ホーム</router-link>
    </header>
</template>

<script setup lang="ts">
</script>

<style scoped>
.admin-header {
    background: #2b3036;
    color: #ffffff;
    padding: 8px 28px;
    height: 48px;
    display: flex;
    align-items: center;
    box-shadow: none;
}

.admin-title {
    font-size: 1.3rem;
    font-weight: bold;
    margin: 0;
}

.home-button {
    margin-left: auto;
    background: #ffffff;
    color: #2b3036;
    padding: 6px 12px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.home-button:hover {
    opacity: 0.9;
}
</style>
