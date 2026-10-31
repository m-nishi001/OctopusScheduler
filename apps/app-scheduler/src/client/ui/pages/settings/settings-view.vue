<template>
    <PageShell title="設定" :tabs="tabs" :active-key="currentTab" @select="selectTab">
        <template #actions><SettingsHeaderActions /></template>
        <p class="tab-hint">{{ SETTINGS_TAB_HINTS[currentTab] }}</p>
        <EventEditor v-if="currentTab === 'events'" />
        <AssetListEditor v-else-if="currentTab === 'assets'" />
        <MembersEditor v-else-if="currentTab === 'members'" />
        <KeyboardShortcutEditor v-else-if="currentTab === 'keyboard-shortcuts'" />
    </PageShell>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PageShell } from '@octopus/ui-kit';
import { SETTINGS_TAB_HINTS } from './help/help-content';
import SettingsHeaderActions from './frames/settings-header-actions.vue';
import EventEditor from './event-list/event-list.vue';
import AssetListEditor from './asset-list/asset-list-editor.vue';
import MembersEditor from './members/members-editor.vue';
import KeyboardShortcutEditor from './keyboard-shortcut/keyboard-shortcut-editor.vue';

const tabs = [
    { key: 'events', label: 'イベント' },
    { key: 'assets', label: 'アセット' },
    { key: 'members', label: 'メンバー' },
    { key: 'keyboard-shortcuts', label: 'ショートカット' },
];
// 表示中のタブはURL(?tab=)に持つので、再読み込みやリンクで同じタブに戻れる
const route = useRoute();
const router = useRouter();
// 旧「アカウント」タブは「メンバー」に統合した(古いリンクは members に移す)
const LEGACY_TABS: Record<string, string> = { accounts: 'members' };
const currentTab = computed(() => {
    const raw = String(route.query.tab ?? '');
    const tab = LEGACY_TABS[raw] ?? raw;
    return tabs.some((t) => t.key === tab) ? tab : 'events';
});
watchEffect(() => {
    const raw = String(route.query.tab ?? '');
    if (raw in LEGACY_TABS) router.replace({ query: { ...route.query, tab: LEGACY_TABS[raw] } });
});
const selectTab = (key: string) => router.replace({ query: { ...route.query, tab: key } });
</script>

<style scoped>
.tab-hint {
    margin: 0 0 var(--ui-space-3);
    color: var(--ui-text-muted);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
