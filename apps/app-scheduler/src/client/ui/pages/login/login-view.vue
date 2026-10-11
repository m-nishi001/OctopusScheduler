<template>
    <div class="login-view">
        <form class="login-view__card" @submit.prevent="submit">
            <h1 class="login-view__title">ログイン</h1>
            <p v-if="qrBusy" class="login-view__notice" role="status">受付のQRコードでログインしています…</p>
            <UiField label="ID" required>
                <input v-model="id" type="text" autocomplete="username" autofocus />
            </UiField>
            <UiField label="パスワード" required :error="error">
                <input v-model="password" type="password" autocomplete="current-password" />
            </UiField>
            <UiButton variant="primary" type="submit" :loading="busy" :disabled="!id.trim() || !password">
                ログイン
            </UiButton>
        </form>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { UiButton, UiField } from '@octopus/ui-kit';
import { roleOf, useAuthSession } from '../../../control/auth/auth-session';
import { resolveLoginRedirect } from '../../../control/router/auth-guard';

const route = useRoute();
const router = useRouter();
const { signIn, signInWithKey } = useAuthSession();

const id = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);
const qrBusy = ref(false);

/** ログイン後の遷移。戻り先は役割ごとに許可されたパスだけ(オープンリダイレクト対策を含む)。 */
async function goAfterLogin(member: Parameters<typeof roleOf>[0], redirect: unknown) {
    await router.replace(resolveLoginRedirect(roleOf(member), redirect));
}

async function submit() {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
        const member = await signIn(id.value.trim(), password.value);
        await goAfterLogin(member, route.query.redirect);
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}

/**
 * 受付QRのURL(`#/login?id=…&key=…`)で開かれたら、そのままログインする。
 * キーは最初にURLから取り除く(履歴・共有URLに残さない)。失敗したら通常のフォームで続けられる。
 */
onMounted(async () => {
    const { id: qrId, key: qrKey, redirect } = route.query;
    if (typeof qrId !== 'string' || typeof qrKey !== 'string' || !qrId || !qrKey) return;
    id.value = qrId;
    qrBusy.value = true;
    try {
        await router.replace({ path: '/login', query: typeof redirect === 'string' ? { redirect } : {} });
        const member = await signInWithKey(qrId, qrKey);
        await goAfterLogin(member, redirect);
    } catch {
        error.value = 'QRコードでログインできませんでした。受付でお知らせください。ID とパスワードでもログインできます。';
    } finally {
        qrBusy.value = false;
    }
});
</script>

<style scoped>
.login-view {
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    min-height: 100vh;
    padding: var(--ui-space-5, 24px) var(--ui-space-4, 16px);
    /* PageShell を使わない画面なので、ui-kit の背景/文字色を自前で当てる */
    background: var(--ui-bg, #23252b);
    color: var(--ui-text, #fff);
}

.login-view__card {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
    width: 100%;
    max-width: 360px;
}

.login-view__notice {
    margin: 0;
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.login-view__title {
    margin: 0 0 var(--ui-space-2, 8px);
    font-size: var(--ui-font-lg, 1.25rem);
}
</style>
