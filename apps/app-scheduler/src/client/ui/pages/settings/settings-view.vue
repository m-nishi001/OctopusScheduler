<template>
    <PageShell title="設定画面" :tabs="tabs" :active-key="currentTab" @select="currentTab = $event">
        <template #actions><SettingsHeaderActions /></template>
        <EventEditor v-if="currentTab === 'events'" />
        <AssetListEditor v-else-if="currentTab === 'assets'" />
        <MemberDirectoryEditor v-else-if="currentTab === 'members'" />
        <KeyboardShortcutEditor v-else-if="currentTab === 'keyboard-shortcuts'" />
    </PageShell>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { PageShell } from '@octopus/ui-kit';
import SettingsHeaderActions from './frames/settings-header-actions.vue';
import EventEditor from './event-list/event-list.vue';
import AssetListEditor from './asset-list/asset-list-editor.vue';
import MemberDirectoryEditor from './member-directory/member-directory-editor.vue';
import KeyboardShortcutEditor from './keyboard-shortcut/keyboard-shortcut-editor.vue';

const tabs = [
    { key: 'events', label: 'イベント' },
    { key: 'assets', label: 'アセット' },
    { key: 'members', label: 'メンバー' },
    { key: 'keyboard-shortcuts', label: 'ショートカット' },
];
const currentTab = ref('events');

const channel = new BroadcastChannel('octopus-control');

const handleKeydown = (event: KeyboardEvent) => {
    // ショートカットキーの例: Ctrl+1 でイベント送信
    if (event.ctrlKey && event.key === '1') {
        // Use AppEventDto shape: { actionType, eventId }
        console.debug('[settings-view] shortcut detected: sending AppEventDto', {
            actionType: 'start',
            eventId: 'sample',
        });
        channel.postMessage({ actionType: 'start', eventId: 'sample' });
    }
    // 他のショートカットも追加可能
};

onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
    channel.close();
});
</script>
