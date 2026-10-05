<template>
  <PageShell title="管理画面" :tabs="tabs" :active-key="activeKey" @select="router.push(`${BASE}/${$event}`)">
    <template #actions>
      <SyncStatusIndicator :status="status" :last-error="lastError" />
      <button class="header-btn" :disabled="downloadingBackup" @click="onDownloadBackup">バックアップ</button>
      <router-link to="/jackpot-home" class="home-button" aria-label="ホームへ戻る">ホーム</router-link>
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
import { PageShell } from '@octopus/ui-kit';
import SyncStatusIndicator from '@ui/components/sync-status-indicator.vue';
import { useBackgroundSync } from '../../../composables/use-background-sync';
import { exportLocalBackup } from '../../../../control/backup/backup-util';

const BASE = '/jackpot-admin';
const router = useRouter();
const route = useRoute();
const { status, lastError } = useBackgroundSync();

const tabs = [
  { key: 'assets', label: 'アセット' },
  { key: 'members', label: 'メンバー' },
  { key: 'prizes', label: '景品' },
  { key: 'results', label: '抽選結果' },
  { key: 'remote-control', label: 'リモート操作' },
  { key: 'screens', label: '画面設定' },
];

const screenTabs = [
  { path: 'home', label: 'ホーム' },
  { path: 'opening', label: 'オープニング' },
  { path: 'description', label: '説明' },
  { path: 'demo', label: 'デモ抽選' },
  { path: 'draw', label: '本抽選' },
  { path: 'result', label: '最終結果' },
  { path: 'ending', label: 'エンディング' },
];

// /jackpot-admin(子パスなし)はメンバー画面を表示するため members 扱いにする。
const activeKey = computed(() => {
  const seg = (route.path ?? '').replace(BASE, '').split('/').filter(Boolean)[0];
  return seg ?? 'members';
});

const downloadingBackup = ref(false);

async function onDownloadBackup() {
  downloadingBackup.value = true;
  try {
    await exportLocalBackup(true);
  } catch (e) {
    console.error('Failed to export local backup', e);
  } finally {
    downloadingBackup.value = false;
  }
}
</script>

<style scoped>
.home-button {
  background: #ffffff;
  color: #2b3036;
  padding: 4px 12px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
}

.header-btn {
  background: transparent;
  color: #cfd6dd;
  border: 1px solid #4a5158;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.header-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.sub-link {
  color: #cfd6dd;
  text-decoration: none;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.9rem;
  border: 1px solid #3a4048;
}

.sub-link.active-sub {
  color: #23252b;
  background: #aee1ff;
  border-color: #aee1ff;
  font-weight: 700;
}
</style>
