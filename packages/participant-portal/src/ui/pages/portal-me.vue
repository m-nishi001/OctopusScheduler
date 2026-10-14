<template>
    <section class="pp-me">
        <article class="pp-card pp-me__card">
            <span class="pp-me__avatar" aria-hidden="true">{{ initial }}</span>
            <div class="pp-me__who">
                <p class="pp-me__name" data-testid="me-name">{{ auth.currentMember.value?.name ?? '—' }}</p>
                <p class="pp-muted" data-testid="me-id">ID: {{ auth.currentMember.value?.id ?? '—' }}</p>
            </div>
        </article>

        <button type="button" class="pp-button pp-button--ghost" :disabled="signingOut" data-testid="me-signout" @click="signOut">
            ログアウト
        </button>
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useParticipantAuth } from '../../model/participant-auth';
import { usePortalContext } from '../../model/use-portal-session';

const router = useRouter();
const auth = useParticipantAuth();
const session = usePortalContext();

const signingOut = ref(false);
const initial = computed(() => Array.from(auth.currentMember.value?.name ?? '?')[0] ?? '?');

/** 退室して保存した入室情報を消してからログアウトする(共有端末で次の人が前の人の端末を引き継がないように)。 */
async function signOut() {
    if (signingOut.value) return;
    signingOut.value = true;
    try {
        session.leave();
        await auth.signOut();
        await router.push('/login');
    } finally {
        signingOut.value = false;
    }
}
</script>

<style scoped>
.pp-me {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.pp-me__card {
    display: flex;
    align-items: center;
    gap: 16px;
}

.pp-me__avatar {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--pp-ink);
    background: linear-gradient(180deg, var(--pp-gold-light), var(--pp-gold-deep));
}

.pp-me__name {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 800;
}
</style>
