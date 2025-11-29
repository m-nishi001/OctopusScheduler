<template>
    <div class="home dark-bg">
        <div class="home-content">
            <h1 class="home-title">
                <span class="octo-icon">🐙</span> Octopus Scheduler
            </h1>
            <div class="btn-grid">
                <button class="main-btn" @click="goToSettings" aria-label="設定画面">
                    <span class="btn-icon">⚙️</span>
                    <span class="btn-label">設定画面</span>
                </button>
                <button class="main-btn" @click="goToExecute" aria-label="実行画面">
                    <span class="btn-icon">🎬</span>
                    <span class="btn-label">実行画面へ</span>
                </button>
                <button class="main-btn" @click="goToJackpotGame" aria-label="Jackpot Game">
                    <span class="btn-icon">🎰</span>
                    <span class="btn-label">Jackpot Game</span>
                </button>
                <button class="main-btn" @click="goToQuizGame" aria-label="Quiz Game">
                    <span class="btn-icon">🎯</span>
                    <span class="btn-label">Quiz Game</span>
                </button>
                <button class="main-btn" @click="goToCardGame" aria-label="Card Game">
                    <span class="btn-icon">🃏</span>
                    <span class="btn-label">Card Game</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const channel = new BroadcastChannel('octopus-control');

const goToSettings = () => router.push({ name: 'settings' });
const goToExecute = () => window.open('/#/execute', '_blank');
const goToJackpotGame = () => {
    // Open the jackpot page directly instead of using legacy NAVIGATE via BroadcastChannel
    window.open('/#/jackpot-home', '_blank');
};
const goToQuizGame = () => {
    // Open the quiz admin page directly instead of using legacy NAVIGATE
    window.open('/#/quiz-admin', '_blank');
};
const goToCardGame = () => {
    // Open the card game page directly instead of using legacy NAVIGATE
    window.open('/#/card-home', '_blank');
};

const handleKeydown = (event: KeyboardEvent) => {
    // ショートカットキーの例: Ctrl+1 でイベント送信
    // Replace legacy SHOW_IMAGE with new IAppEventDto ({ actionType, eventId })
    if (event.ctrlKey && event.key === '1') {
        console.debug('[home-view] shortcut detected: sending IAppEventDto start for sample', { id: 'sample' });
        channel.postMessage({ actionType: 'start', eventId: 'sample' });
    }
    // 他のショートカットも追加可能
};

onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
    channel.close();
});
</script>

<style scoped>
.home {
    background: linear-gradient(135deg, #181818 0%, #222 100%);
    color: #fff;
    min-height: 100vh;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.home-content {
    width: 100vw;
    height: 100vh;
    padding: 2em;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}

.home-title {
    font-size: 2.2em;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 2em;
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: #fff;
    text-shadow: 0 2px 12px #000a;
}

.octo-icon {
    font-size: 1.3em;
}

.btn-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
    margin-bottom: 2em;
    width: 100%;
    align-items: stretch;
    flex: 1 1 auto;
    grid-auto-rows: 1fr;
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
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6em;
    justify-content: center;
    text-align: center;
    min-height: 0;
    height: 100%;
}

.main-btn .btn-icon {
    font-size: 2.2em;
}

.main-btn .btn-label {
    display: inline-block;
}

.main-btn:hover,
.main-btn:focus {
    background: linear-gradient(90deg, #2a2a2a 0%, #333 100%);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    transform: translateY(-2px) scale(1.04);
}

.main-btn:active {
    background: #1a1a1a;
    transform: scale(0.98);
}

.desc {
    color: #bbb;
    font-size: 1em;
    margin-top: 1em;
    text-align: center;
}

@media (max-width: 600px) {
    .home-content {
        width: 100vw;
        height: 100vh;
        padding: 0.5em;
    }

    .home-title {
        font-size: 1.3em;
    }

    .main-btn {
        font-size: 1em;
        padding: 0.9em 1rem;
        min-height: 120px;
    }

    .btn-grid {
        grid-template-columns: 1fr;
    }


}
</style>