<template>
    <div class="participant-home">
        <main class="participant-home__card">
            <h1 class="participant-home__title">ようこそ</h1>
            <p v-if="currentMember" class="participant-home__name" data-testid="participant-name">
                {{ currentMember.name }} さん
            </p>
            <p class="participant-home__note">
                ログインできました。イベントが始まると、ここにお知らせが表示されます。
            </p>
            <UiButton @click="onSignOut">ログアウト</UiButton>
        </main>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { UiButton } from '@octopus/ui-kit';
import { useAuthSession } from '../../../control/auth/auth-session';

const router = useRouter();
const { currentMember, signOut } = useAuthSession();

async function onSignOut() {
    await signOut();
    await router.push('/login');
}
</script>

<style scoped>
.participant-home {
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    min-height: 100vh;
    padding: var(--ui-space-5, 24px) var(--ui-space-4, 16px);
    background: var(--ui-bg, #23252b);
    color: var(--ui-text, #fff);
}

.participant-home__card {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
    width: 100%;
    max-width: 420px;
}

.participant-home__title {
    margin: 0;
    font-size: var(--ui-font-lg, 1.25rem);
}

.participant-home__name {
    margin: 0;
    font-size: var(--ui-font-lg, 1.25rem);
    font-weight: 700;
}

.participant-home__note {
    margin: 0;
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
