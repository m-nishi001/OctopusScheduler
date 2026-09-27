<template>
    <header class="admin-header">
        <h1 class="admin-title">クイズ管理</h1>
        <div class="header-actions">
            <SyncStatusIndicator :status="status" :last-error="lastError" />
            <router-link to="/home" class="home-button" aria-label="ホームへ戻る">ホーム</router-link>
        </div>
    </header>
</template>

<script setup lang="ts">
import SyncStatusIndicator from '../../../components/sync-status-indicator.vue';
import { useBackgroundSync } from '../../../composables/use-background-sync';

const { status, lastError } = useBackgroundSync();
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

.header-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 16px;
}

.home-button {
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
