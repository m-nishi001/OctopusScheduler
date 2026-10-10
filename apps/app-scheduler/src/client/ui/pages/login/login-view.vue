<template>
    <div class="login-view">
        <form class="login-view__card" @submit.prevent="submit">
            <h1 class="login-view__title">管理者ログイン</h1>
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
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { UiButton, UiField } from '@octopus/ui-kit';
import { useAuthSession } from '../../../control/auth/auth-session';

const route = useRoute();
const router = useRouter();
const { signIn, signOut } = useAuthSession();

const id = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

/** ログイン後の戻り先。同一アプリ内のパスのみ許可する(オープンリダイレクト対策)。 */
function redirectTarget(): string {
    const redirect = route.query.redirect;
    return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : '/home';
}

async function submit() {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
        const member = await signIn(id.value.trim(), password.value);
        if (!member.isAdmin) {
            await signOut();
            error.value = '管理者権限がありません';
            return;
        }
        await router.replace(redirectTarget());
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}
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

.login-view__title {
    margin: 0 0 var(--ui-space-2, 8px);
    font-size: var(--ui-font-lg, 1.25rem);
}
</style>
