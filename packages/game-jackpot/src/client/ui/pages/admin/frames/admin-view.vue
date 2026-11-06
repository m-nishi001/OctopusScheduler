<template>
  <PageShell title="管理画面" :tabs="tabs" :active-key="activeKey" @select="router.push(`${BASE}/${$event}`)">
    <template #actions>
      <HeaderActions show-backup :backup-busy="downloadingBackup" :sync-status="status" :sync-error="lastError" :sync-log="log" :sync-kind-labels="SYNC_KIND_LABELS"
        @backup="onDownloadBackup" @home="router.push('/home')">
        <UiButton icon="play" size="sm" @click="startDemo">デモ実行</UiButton>
      </HeaderActions>
    </template>
    <template v-if="activeKey === 'screens'" #subtabs>
      <router-link v-for="s in screenTabs" :key="s.path" :to="`${BASE}/screens/${s.path}`" class="sub-link"
        active-class="active-sub">{{ s.label }}</router-link>
    </template>
    <router-view />
  </PageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { HeaderActions, PageShell, UiButton, toast } from '@octopus/ui-kit';
import { DEMO_QUERY_KEY, setJackpotScope } from '@model/jackpot-session';
import { SYNC_KIND_LABELS, useBackgroundSync } from '../../../composables/use-background-sync';
import { exportLocalBackup } from '../../../../control/backup/backup-util';

const BASE = '/jackpot-admin';
const router = useRouter();
const route = useRoute();
const { status, lastError, log } = useBackgroundSync();

// 管理画面は常に本番(live)スコープ。デモ実行後に戻ってきた場合もここで戻す。
setJackpotScope('live');

// 設定画面からの動作確認用。抽選結果・確変状態はデモ専用ストアに分離される。
const startDemo = () => router.push({ path: '/jackpot-opening', query: { [DEMO_QUERY_KEY]: '1' } });

const tabs = [
  { key: 'members', label: 'メンバー' },
  { key: 'prizes', label: '景品' },
  { key: 'results', label: '抽選結果' },
  { key: 'screens', label: '画面設定' },
];

const screenTabs = [
  { path: 'opening', label: 'オープニング' },
  { path: 'description', label: '説明' },
  { path: 'demo', label: 'デモ抽選' },
  { path: 'draw', label: '本抽選' },
  { path: 'result', label: '最終結果' },
  { path: 'ending', label: 'エンディング' },
];

// /jackpot-admin(子パスなし)はメンバー画面を表示するため members 扱いにする。
// スケジューラ内では /execute/jackpot-admin/... で描画されるため、接頭辞に依存せず BASE 以降を取り出す。
const activeKey = computed(() => {
  const m = /\/jackpot-admin(?:\/([^/]+))?/.exec(route.path ?? '');
  return m?.[1] ?? 'members';
});

const downloadingBackup = ref(false);

async function onDownloadBackup() {
  downloadingBackup.value = true;
  try {
    const { filename } = await exportLocalBackup();
    toast.success(`バックアップを保存しました(${filename})`);
  } catch (e) {
    console.error('Failed to export local backup', e);
    toast.error('バックアップを作れませんでした');
  } finally {
    downloadingBackup.value = false;
  }
}
</script>

<style scoped>
.sub-link {
  color: var(--ui-text-muted, #cfd6dd);
  text-decoration: none;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: var(--ui-font-sm, 0.875rem);
  border: 1px solid var(--ui-border, #3a4048);
}

.sub-link.active-sub {
  color: var(--ui-accent-contrast, #12263a);
  background: var(--ui-accent, #aee1ff);
  border-color: var(--ui-accent, #aee1ff);
  font-weight: 700;
}
</style>
