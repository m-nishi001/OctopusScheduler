<template>
    <div class="connecting-view" data-testid="connecting-view">
        <div class="connecting-view__card" role="status">
            <h1 class="connecting-view__title">通信を確認しています…</h1>
            <p class="connecting-view__text">電波の届く場所で、そのままお待ちください。つながり次第、元の画面へ戻ります。</p>
            <RouterLink class="connecting-view__link" :to="loginTo" data-testid="connecting-to-login">ログイン画面へ</RouterLink>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ensureRole } from '../../../control/auth/auth-session';
import { UNVERIFIED, isSafeRedirect, resolveLoginRedirect, retryDelayMs } from '../../../control/router/auth-guard';

/**
 * 接続待ち画面。ログインを確認できないあいだ(通信エラー等)、文言とリンクだけを表示する。
 * 管理用の画面やデータは、確認が取れるまで一切表示しない。確認できたら元の画面へ戻る。
 */
const route = useRoute();
const router = useRouter();

const redirect = computed(() => (isSafeRedirect(route.query.redirect) ? route.query.redirect : undefined));
const loginTo = computed(() => ({ path: '/login', query: redirect.value ? { redirect: redirect.value } : {} }));

let attempt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let disposed = false;

function schedule() {
    clearTimeout(timer);
    if (disposed) return;
    timer = setTimeout(retry, retryDelayMs(attempt));
    attempt += 1;
}

async function retry() {
    if (running || disposed) return;
    running = true;
    clearTimeout(timer);
    try {
        const role = await ensureRole();
        if (disposed) return;
        if (role === UNVERIFIED) return schedule();
        await router.replace(role ? resolveLoginRedirect(role, redirect.value) : loginTo.value);
    } finally {
        running = false;
    }
}

function onOnline() {
    attempt = 0;
    void retry();
}

onMounted(() => {
    window.addEventListener('online', onOnline);
    schedule();
});

onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(timer);
    window.removeEventListener('online', onOnline);
});
</script>

<style scoped>
.connecting-view {
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    min-height: 100vh;
    padding: var(--ui-space-5, 24px) var(--ui-space-4, 16px);
    background: var(--ui-bg, #23252b);
    color: var(--ui-text, #fff);
}

.connecting-view__card {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
    width: 100%;
    max-width: 360px;
}

.connecting-view__title {
    margin: 0 0 var(--ui-space-2, 8px);
    font-size: var(--ui-font-lg, 1.25rem);
}

.connecting-view__text {
    margin: 0;
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.connecting-view__link {
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
