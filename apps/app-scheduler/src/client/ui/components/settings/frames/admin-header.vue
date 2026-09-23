<template>
    <header class="admin-header">
        <h1 class="admin-title">設定画面</h1>
        <div class="admin-actions">
            <button class="bulk-sync-btn" @click="showDialog = true">一括同期</button>
        </div>
        <BulkSyncDialog v-if="showDialog" @close="showDialog = false" />
    </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BulkSyncDialog from '../bulk-sync/BulkSyncDialog.vue';

const showDialog = ref(false);
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

.admin-actions {
    margin-left: auto;
}

.bulk-sync-btn {
    background: #4a90e2;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}

.bulk-sync-btn:hover {
    opacity: 0.95;
}
</style>