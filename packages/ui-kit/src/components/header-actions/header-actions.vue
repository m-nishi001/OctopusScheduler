<template>
    <div class="ui-header-actions">
        <SyncStatusIndicator v-if="syncStatus" :status="syncStatus" :last-error="syncError" />
        <slot />
        <UiButton v-if="showBackup" icon="download" size="sm" :loading="backupBusy" @click="emit('backup')">{{ backupLabel }}</UiButton>
        <UiButton icon="home" size="sm" @click="emit('home')">{{ homeLabel }}</UiButton>
    </div>
</template>

<script setup lang="ts">
import UiButton from '../ui-button/ui-button.vue';
import SyncStatusIndicator, { type SyncStatus } from '../sync-status-indicator/sync-status-indicator.vue';

withDefaults(defineProps<{ showBackup?: boolean; backupBusy?: boolean; syncStatus?: SyncStatus; syncError?: string | null; backupLabel?: string; homeLabel?: string }>(), {
    showBackup: false,
    backupLabel: 'バックアップ',
    homeLabel: 'ホーム',
});

const emit = defineEmits<{ backup: []; home: [] }>();
</script>

<style scoped>
.ui-header-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ui-space-3, 12px);
}
</style>
