<template>
    <div class="ui-header-actions">
        <slot />
        <UiButton v-if="showBackup" icon="download" size="sm" :loading="backupBusy" @click="emit('backup')">{{ backupLabel }}</UiButton>
        <UiButton icon="home" size="sm" @click="emit('home')">{{ homeLabel }}</UiButton>
    </div>
</template>

<script setup lang="ts">
import UiButton from '../ui-button/ui-button.vue';

withDefaults(defineProps<{ showBackup?: boolean; backupBusy?: boolean; backupLabel?: string; homeLabel?: string }>(), {
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
