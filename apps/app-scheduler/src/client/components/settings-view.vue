<template>
    <div class="admin-layout">
        <AdminHeader />
        <div class="admin-body">
            <AdminSidemenu :currentTab="currentTab" @tabChange="currentTab = $event" />
            <main class="admin-content">
                <EventEditor v-if="currentTab === 'events'" />
                <AssetListEditor v-else-if="currentTab === 'assets'" />
                <KeyboardShortcutEditor v-else-if="currentTab === 'keyboard-shortcuts'" />
            </main>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import AdminHeader from '../ui/components/settings/frames/admin-header.vue';
import AdminSidemenu from '../ui/components/settings/frames/admin-sidemenu.vue';
import EventEditor from '../ui/components/settings/event-list/event-list.vue';
import AssetListEditor from '../ui/components/settings/asset-list/asset-list-editor.vue';
import KeyboardShortcutEditor from '../ui/components/settings/keyboard-shortcut/keyboard-shortcut-editor.vue';

const currentTab = ref('events');

const channel = new BroadcastChannel('octopus-control');

const handleKeydown = (event: KeyboardEvent) => {
    // ショートカットキーの例: Ctrl+1 でイベント送信
    if (event.ctrlKey && event.key === '1') {
        // Use IAppEventDto shape: { actionType, eventId }
        console.debug('[settings-view] shortcut detected: sending IAppEventDto', {
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

<style scoped>
.admin-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #23252b;
}

.admin-body {
    display: flex;
    flex: 1;
    min-height: 0;
}

.admin-content {
    flex: 1;
    padding: 20px 4vw;
    background: transparent;
    color: #fff;
    font-size: 16px;
    /* base for admin content so child components use consistent font sizing */
    min-width: 0;
    overflow: auto;
    min-height: 0;
}

@media (max-width: 900px) {
    .admin-content {
        padding: 16px 2vw;
    }
}
</style>