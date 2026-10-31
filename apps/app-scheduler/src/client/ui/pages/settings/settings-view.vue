<template>
    <PageShell title="設定" :tabs="tabs" :active-key="currentTab" @select="selectTab">
        <template #actions><SettingsHeaderActions /></template>
        <p class="tab-hint">{{ SETTINGS_TAB_HINTS[currentTab] }}</p>
        <EventEditor v-if="currentTab === 'events'" />
        <AssetListEditor v-else-if="currentTab === 'assets'" />
        <MemberDirectoryEditor v-else-if="currentTab === 'members'" />
        <AccountsEditor v-else-if="currentTab === 'accounts'" />
    </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PageShell } from '@octopus/ui-kit';
import { SETTINGS_TAB_HINTS } from './help/help-content';
import SettingsHeaderActions from './frames/settings-header-actions.vue';
import EventEditor from './event-list/event-list.vue';
import AssetListEditor from './asset-list/asset-list-editor.vue';
import MemberDirectoryEditor from './member-directory/member-directory-editor.vue';
import AccountsEditor from './accounts/accounts-editor.vue';

const tabs = [
    { key: 'events', label: 'イベント' },
    { key: 'assets', label: 'アセット' },
    { key: 'members', label: 'メンバー' },
    { key: 'accounts', label: 'アカウント' },
];
// 表示中のタブはURL(?tab=)に持つので、再読み込みやリンクで同じタブに戻れる
const route = useRoute();
const router = useRouter();
const currentTab = computed(() => {
    const tab = String(route.query.tab ?? '');
    return tabs.some((t) => t.key === tab) ? tab : 'events';
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
