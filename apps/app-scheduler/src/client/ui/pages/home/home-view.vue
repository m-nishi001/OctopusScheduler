<template>
    <div class="home">
        <div class="home-content">
            <h1 class="home-title">
                <span class="octo-icon">🐙</span> Octopus Scheduler
            </h1>
            <p v-if="currentMember" class="home-account">
                {{ currentMember.name }} でログイン中
                <button class="home-signout" type="button" @click="onSignOut">ログアウト</button>
            </p>

            <!-- 当日の進行: これだけ押せば始められる -->
            <button class="main-btn main-btn--primary" type="button" data-testid="home-run" @click="goToSessions">
                <span class="btn-icon">📡</span>
                <span class="btn-label">イベントを開催・進行する</span>
                <span class="btn-desc">クイズやジャックポットを、その場で始められます</span>
            </button>

            <!-- 事前の準備・管理 -->
            <h2 class="home-section">準備・管理</h2>
            <div class="btn-grid">
                <button class="main-btn" type="button" data-testid="home-quiz" @click="goToQuizGame">
                    <span class="btn-icon">🎯</span>
                    <span class="btn-label">クイズの準備</span>
                    <span class="btn-desc">問題・選択肢・メンバー</span>
                </button>
                <button class="main-btn" type="button" data-testid="home-jackpot" @click="goToJackpotGame">
                    <span class="btn-icon">🎰</span>
                    <span class="btn-label">ジャックポットの準備</span>
                    <span class="btn-desc">景品・メンバー・画面の設定</span>
                </button>
                <button class="main-btn" type="button" data-testid="home-settings" @click="goToSettings">
                    <span class="btn-icon">⚙️</span>
                    <span class="btn-label">設定</span>
                    <span class="btn-desc">アカウント・アセット・ショートカット</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthSession } from '../../../control/auth/auth-session';

const router = useRouter();
const { currentMember, signOut } = useAuthSession();

const onSignOut = async () => {
    await signOut();
    await router.push('/login');
};

const goToSettings = () => router.push({ name: 'settings' });
const goToSessions = () => router.push('/sessions');
const goToJackpotGame = () => router.push('/jackpot-admin');
const goToQuizGame = () => router.push('/quiz-admin');
</script>

<style scoped>
.home {
    background: linear-gradient(135deg, #181818 0%, #222 100%);
    color: #fff;
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}

.home-content {
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 2em;
    display: flex;
    flex-direction: column;
    gap: 1.2em;
    box-sizing: border-box;
}

.home-title {
    font-size: 2.2em;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: #fff;
    text-shadow: 0 2px 12px #000a;
}

.home-account {
    margin: 0;
    color: #cfd6dd;
    font-size: 0.95em;
}

.home-signout {
    margin-left: 0.8em;
    padding: 0.2em 0.8em;
    color: inherit;
    background: transparent;
    border: 1px solid #666;
    border-radius: 4px;
    cursor: pointer;
}

.home-section {
    margin: 0.6em 0 0;
    font-size: 1rem;
    color: #cfd6dd;
    font-weight: 600;
}

.octo-icon {
    font-size: 1.3em;
}

.btn-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    width: 100%;
}

.main-btn {
    font-size: 1.1em;
    font-weight: 600;
    padding: 1.25em 1.2em;
    background: linear-gradient(90deg, #222 0%, #2a2a2a 100%);
    color: #fff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
    outline: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4em;
    justify-content: center;
    text-align: center;
}

.main-btn--primary {
    background: linear-gradient(90deg, #1565c0 0%, #1e88e5 100%);
    min-height: 160px;
    font-size: 1.3em;
}

.main-btn .btn-icon {
    font-size: 2.2em;
}

.main-btn .btn-desc {
    font-size: 0.7em;
    font-weight: 400;
    opacity: 0.8;
}

.main-btn:hover,
.main-btn:focus-visible {
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    transform: translateY(-2px);
}

.main-btn:active {
    transform: scale(0.98);
}

@media (max-width: 600px) {
    .home-content {
        padding: 1em;
    }

    .home-title {
        font-size: 1.5em;
    }

    .main-btn {
        font-size: 1em;
        padding: 0.9em 1rem;
    }

    .main-btn--primary {
        min-height: 140px;
        font-size: 1.15em;
    }
}
</style>
