<template>
    <PageShell title="セッション">
        <template #actions>
            <UiButton icon="sync" :loading="loading" @click="load">更新</UiButton>
            <UiButton @click="router.push('/home')">ホームへ</UiButton>
        </template>

        <section class="sessions">
            <p class="sessions__lead">
                セッション(パーティールーム)を作り、会場の投影端末を「ホスト」として、手元の端末を「管理」として接続します。
                参加者はQRコードまたは参加コードでポータルに入ります。
                ログイン済みの参加者(受付QR)は、「ポータルに公開」したセッションに自動で入ります。公開できるのは同時に1つです。
            </p>

            <form class="sessions__create" @submit.prevent="create">
                <UiField label="セッション名" required>
                    <input v-model="name" type="text" maxlength="60" autocomplete="off" placeholder="例: 夏祭りイベント" />
                </UiField>
                <label class="sessions__check">
                    <input v-model="demo" type="checkbox" />
                    デモ(リハーサル)として作る
                </label>
                <UiButton type="submit" variant="primary" icon="add" :loading="creating" :disabled="!name.trim()">
                    セッションを作成
                </UiButton>
            </form>

            <p v-if="error" class="sessions__error" role="alert">{{ error }}</p>

            <DataTable :columns="columns" :rows="rows" row-key="id" :loading="loading" empty-text="進行中のセッションはありません">
                <template #cell-code="{ row }"><code class="sessions__code">{{ row.code }}</code></template>
                <template #cell-status="{ row }">{{ statusLabel(row) }}</template>
                <template #cell-portal="{ row }">
                    <span v-if="row.portal" class="sessions__portal" data-testid="portal-on">公開中</span>
                    <span v-else class="sessions__portal-off">—</span>
                </template>
                <template #cell-actions="{ row }">
                    <div class="sessions__actions">
                        <UiButton size="sm" :disabled="row.status === 'closed'" @click="openHost(row.id)">ホストとして開く</UiButton>
                        <UiButton size="sm" variant="primary" :disabled="row.status === 'closed'" @click="openConsole(row.id)">
                            操作する
                        </UiButton>
                        <UiButton size="sm" :disabled="row.status === 'closed' || portalBusyId === row.id" :loading="portalBusyId === row.id"
                            @click="togglePortal(row)">
                            {{ row.portal ? 'ポータル公開を止める' : 'ポータルに公開' }}
                        </UiButton>
                        <UiButton size="sm" variant="danger" :disabled="row.status === 'closed' || closingId === row.id" :loading="closingId === row.id" @click="closeOne(row)">
                            終了
                        </UiButton>
                    </div>
                </template>
            </DataTable>
        </section>
    </PageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { DataTable, PageShell, UiButton, UiField, toast, useConfirm } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import { SessionAdminRepository } from '@octopus/session-hub';
import type { SessionSummary } from '@octopus/session-hub';

/** 一覧の自動更新間隔。参加者の人数とは無関係な低頻度の操作画面なので長めにする。 */
const REFRESH_MS = 20_000;

const router = useRouter();
const repo = container.resolve(SessionAdminRepository);
const { confirm } = useConfirm();

const columns: DataTableColumn[] = [
    { key: 'name', label: 'セッション名' },
    { key: 'code', label: '参加コード' },
    { key: 'status', label: '状態' },
    { key: 'portal', label: '参加者ポータル' },
    { key: 'actions', label: '操作' },
];

const sessions = ref<SessionSummary[]>([]);
const loading = ref(false);
const creating = ref(false);
const closingId = ref<string | null>(null);
const portalBusyId = ref<string | null>(null);
const error = ref('');
const name = ref('');
const demo = ref(false);

// 終了済みは下に寄せる
const rows = computed(() => [...sessions.value].sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed') || b.createdAtMs - a.createdAtMs));

function statusLabel(s: SessionSummary): string {
    const base = s.status === 'closed' ? '終了' : s.status === 'live' ? '進行中' : '待機中';
    return s.mode === 'demo' ? `${base}(デモ)` : base;
}

async function load() {
    loading.value = true;
    try {
        sessions.value = await repo.list();
        error.value = '';
    } catch (e) {
        error.value = `セッション一覧を取得できませんでした: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
        loading.value = false;
    }
}

async function create() {
    if (creating.value || !name.value.trim()) return;
    creating.value = true;
    try {
        const meta = await repo.create({ name: name.value.trim(), mode: demo.value ? 'demo' : 'live' });
        name.value = '';
        toast.success(`「${meta.name}」を作成しました(参加コード ${meta.code})`);
        await load();
    } catch (e) {
        toast.error(`作成に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        creating.value = false;
    }
}

/** 参加者ポータルの入口にする/やめる。公開すると他のセッションの公開は外れる。 */
async function togglePortal(row: SessionSummary) {
    if (portalBusyId.value) return;
    const publish = !row.portal;
    if (publish) {
        const other = sessions.value.find((s) => s.portal && s.id !== row.id);
        if (other) {
            const ok = await confirm({
                title: '参加者ポータルの入口を切り替え',
                message: `いま「${other.name}」が公開中です。「${row.name}」に切り替えると、これから入る参加者は「${row.name}」に入ります(すでに接続中の参加者は「${other.name}」に残ります)。`,
                confirmLabel: '切り替える',
            });
            if (!ok) return;
        }
    }
    portalBusyId.value = row.id;
    try {
        await repo.setPortalSession(row.id, publish);
        toast.success(publish ? `「${row.name}」を参加者ポータルに公開しました` : '参加者ポータルへの公開を止めました');
        await load();
    } catch (e) {
        toast.error(`切り替えに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        portalBusyId.value = null;
    }
}

async function closeOne(row: SessionSummary) {
    if (closingId.value) return;
    const ok = await confirm({ title: 'セッションを終了', message: `「${row.name}」を終了します。ホスト・管理・参加者の接続はすべて切断されます。`, confirmLabel: '終了する', danger: true });
    if (!ok) return;
    closingId.value = row.id;
    try {
        await repo.close(row.id);
        toast.success('セッションを終了しました');
        await load();
    } catch (e) {
        toast.error(`終了に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        closingId.value = null;
    }
}

const openHost = (id: string) => router.push(`/session/host/${id}`);
const openConsole = (id: string) => router.push(`/session/console/${id}`);

let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
    void load();
    timer = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void load();
    }, REFRESH_MS);
});
onUnmounted(() => {
    if (timer) clearInterval(timer);
});
</script>

<style scoped>
.sessions {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4, 16px);
    padding: var(--ui-space-4, 16px) 4vw;
}

.sessions__lead { margin: 0; opacity: 0.8; line-height: 1.6; }
.sessions__create { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
.sessions__check { display: flex; align-items: center; gap: 6px; }
.sessions__code { font-size: 1.1rem; letter-spacing: 0.15em; font-weight: 700; }
.sessions__actions { display: flex; flex-wrap: wrap; gap: 6px; }
.sessions__error { color: #ff8a80; margin: 0; }
.sessions__portal { font-weight: 700; color: var(--ui-success, #3fb27f); }
.sessions__portal-off { opacity: 0.5; }
</style>
