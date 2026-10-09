<template>
    <PageShell title="設定画面" :tabs="tabs" :active-key="currentTab" @select="currentTab = $event">
        <template #actions><SettingsHeaderActions /></template>
        <p class="tab-hint">{{ SETTINGS_TAB_HINTS[currentTab] }}</p>
        <EventEditor v-if="currentTab === 'events'" />
        <AssetListEditor v-else-if="currentTab === 'assets'" />
        <MemberDirectoryEditor v-else-if="currentTab === 'members'" />
        <AccountsEditor v-else-if="currentTab === 'accounts'" />
        <KeyboardShortcutEditor v-else-if="currentTab === 'keyboard-shortcuts'" />
    </PageShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { PageShell } from '@octopus/ui-kit';
import { SETTINGS_TAB_HINTS } from './help/help-content';
import SettingsHeaderActions from './frames/settings-header-actions.vue';
import EventEditor from './event-list/event-list.vue';
import AssetListEditor from './asset-list/asset-list-editor.vue';
import MemberDirectoryEditor from './member-directory/member-directory-editor.vue';
import AccountsEditor from './accounts/accounts-editor.vue';
import KeyboardShortcutEditor from './keyboard-shortcut/keyboard-shortcut-editor.vue';

const tabs = [
    { key: 'events', label: 'イベント' },
    { key: 'assets', label: 'アセット' },
    { key: 'members', label: 'メンバー' },
    { key: 'accounts', label: 'アカウント' },
    { key: 'keyboard-shortcuts', label: 'ショートカット' },
];
const currentTab = ref('events');
</script>

<style scoped>
.tab-hint {
    margin: 0 0 var(--ui-space-3);
    color: var(--ui-text-muted);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
