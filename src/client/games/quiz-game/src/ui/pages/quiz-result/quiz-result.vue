<template>
    <div>
        <div class="full-screen-particles" v-if="showFullScreenParticles">
            <div class="full-particle" v-for="i in 100" :key="i"
                :style="{ '--delay': i * 0.01 + 's', '--x': Math.random() * 100 + 'vw', '--y': Math.random() * 100 + 'vh', '--dx': (Math.random() - 0.5) * 400 + 'px', '--dy': (Math.random() - 0.5) * 400 + 'px', '--color': ['#ffd700', '#ff4500', '#00ff00', '#0000ff', '#ff00ff', '#ffff00', '#ff1493', '#00ffff'][i % 8] }">
            </div>
        </div>
        <div class="result-table-container">
            <h1 class="title text-3xl font-bold text-center mb-6">結果表示！</h1>
            <transition-group name="ranking" tag="div" class="ranking-list">
                <div v-for="record in displayedResults" :key="record.name" class="ranking-item"
                    :class="{ 'top3': getRank(record) <= 3, 'first-place': getRank(record) === 1 }">
                    <div class="rank-number">{{ getRank(record) }}</div>
                    <div class="player-name">{{ record.name }}</div>
                    <div class="player-time">{{ formatTime(record.time) }}</div>
                    <div v-if="getRank(record) === 1" class="cracker-particles">
                        <div class="particle" v-for="i in 50" :key="i"
                            :style="{ '--delay': i * 0.02 + 's', '--angle': Math.random() * 360 + 'deg', '--color': ['#ffd700', '#ff4500', '#00ff00', '#0000ff', '#ff00ff', '#ffff00', '#ff1493', '#00ffff'][i % 8] }">
                        </div>
                    </div>
                </div>
            </transition-group>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const showFullScreenParticles = ref(false);

// preview flag removed as it's no longer used; navigation now always pushes to '/quiz-admin'.

// サンプルデータ: 実際はAPI等から取得する
const results = ref([
    { name: '田中 仁', time: new Date(0, 0, 0, 0, 0, 30) },
    { name: '鈴木 太郎', time: new Date(0, 0, 0, 0, 0, 40) },
    { name: '佐藤 花子', time: new Date(0, 0, 0, 0, 1, 0) },
    { name: '大山 隆', time: new Date(0, 0, 0, 0, 1, 20) },
    { name: '高橋 次郎', time: new Date(0, 0, 0, 0, 1, 30) },
    { name: '渡辺 三郎', time: new Date(0, 0, 0, 0, 2, 0) },
    { name: '杉野 正明', time: new Date(0, 0, 0, 0, 2, 20) },
    { name: '山田 次郎', time: new Date(0, 0, 0, 0, 2, 30) },
    { name: '小林 五郎', time: new Date(0, 0, 0, 0, 3, 0) },
    { name: '加藤 六郎', time: new Date(0, 0, 0, 0, 3, 40) },
]);

// 順位はtimeの昇順で決定
const sortedResults = computed(() => {
    return [...results.value].sort((a, b) => a.time.getTime() - b.time.getTime());
});

const displayedResults = ref<{ name: string; time: Date }[]>([]);

function formatTime(date: Date): string {
    const min = date.getMinutes();
    const sec = date.getSeconds();
    if (min > 0) {
        return `${min}分${sec}秒`;
    } else {
        return `${sec}秒`;
    }
}

function getRank(record: { name: string; time: Date }): number {
    return sortedResults.value.findIndex(r => r.name === record.name) + 1;
}

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
    startRankingAnimation();
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});

function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        // TODO: 遷移元に戻したい
        router.push('/quiz-admin');
    }
}

async function startRankingAnimation() {
    const sorted = sortedResults.value;
    // 最下位から順に上に積み上がるように表示
    for (let i = sorted.length - 1; i >= 3; i--) {
        displayedResults.value.unshift(sorted[i]);
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒間隔
    }
    // 上位3位は特別
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待つ
    displayedResults.value.unshift(sorted[2]); // 3位
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待つ
    displayedResults.value.unshift(sorted[1]); // 2位
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待つ
    displayedResults.value.unshift(sorted[0]); // 1位、バン！演出
    showFullScreenParticles.value = true;
    setTimeout(() => showFullScreenParticles.value = false, 3000);
}
</script>

<style scoped>
.result-table-container {
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    padding: 28px 32px;
    border-radius: 0;
    background: #000;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    position: relative;
}

:global(html),
:global(body) {
    overflow: hidden;
}

.title {
    position: absolute;
    top: 17px;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
}

.ranking-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 600px;
}

.ranking-item {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transform: translateX(0);
    opacity: 1;
}

.ranking-enter-from {
    transform: translateX(100%);
    opacity: 0;
}

.ranking-enter-active {
    transition: all 0.5s ease;
}

.ranking-item.top3 {
    background: linear-gradient(90deg, #ffd700, #ffed4e);
    color: #000;
    font-weight: bold;
}

.ranking-item.first-place {
    background: linear-gradient(45deg, #ffd700, #ffed4e, #ffd700);
    color: #000;
    font-weight: bold;
    animation: firstPlaceGlow 2s ease-in-out infinite alternate, bang 1s ease forwards;
    position: relative;
}

@keyframes firstPlaceGlow {
    0% {
        box-shadow: 0 0 20px #ffd700;
    }

    100% {
        box-shadow: 0 0 40px #ffd700, 0 0 60px #ffd700;
    }
}

.cracker-particles {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
}

.particle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: radial-gradient(circle, var(--color), transparent);
    border-radius: 50%;
    animation: crackerBurst 2s ease-out var(--delay) forwards;
}

@keyframes crackerBurst {
    0% {
        transform: scale(0) translate(0, 0) rotate(0deg);
        opacity: 1;
    }

    50% {
        opacity: 1;
        transform: scale(1.5) translate(calc(100px * cos(var(--angle))), calc(100px * sin(var(--angle)))) rotate(180deg);
    }

    100% {
        transform: scale(1) translate(calc(200px * cos(var(--angle))), calc(200px * sin(var(--angle)))) rotate(360deg);
        opacity: 0;
    }
}

.full-screen-particles {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 1000;
}

.full-particle {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: 12px;
    height: 12px;
    background: radial-gradient(circle, var(--color), transparent);
    border-radius: 50%;
    animation: fullScreenBurst 2s ease-out var(--delay) forwards;
}

@keyframes fullScreenBurst {
    0% {
        transform: scale(0) translate(0, 0) rotate(0deg);
        opacity: 1;
    }

    50% {
        transform: scale(1.5) translate(0, 0) rotate(180deg);
        opacity: 1;
    }

    100% {
        transform: scale(1) translate(var(--dx), var(--dy)) rotate(360deg);
        opacity: 0;
    }
}

.rank-number {
    font-size: 1.5rem;
    font-weight: bold;
    margin-right: 20px;
    min-width: 50px;
    text-align: center;
}

.player-name {
    flex: 1;
    font-size: 1.2rem;
}

.player-time {
    font-size: 1.2rem;
    margin-left: 20px;
}
</style>