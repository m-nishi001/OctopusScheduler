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
                    <div class="player-time">{{ formatTime(record.timeSeconds) }}</div>
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
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { GasFunctionService } from '@common-lib/google-apps-script/gas-script-service';
import { StartQuizUseCase } from '../../../model/applications/use-cases/start-quiz-use-case';
import { computeTopResponders } from '../../../services/resultProcessor';
import { quizState } from '../../../services/quizState';
import { normalizeAnswer } from '../../../types/quiz';

const router = useRouter();
const route = useRoute();

// preview flag: prefer route params or named route
const isPreview = computed(() => {
    const paramPreview = (route.params as any)?.preview;
    if (paramPreview !== undefined) {
        if (typeof paramPreview === 'boolean') return paramPreview;
        return String(paramPreview) === 'true' || String(paramPreview) === '1';
    }
    if ((route.name as string) === 'quiz-result-preview') return true;
    return false;
});

const showFullScreenParticles = ref(false);

// preview flag removed as it's no longer used; navigation now always pushes to '/quiz-admin'.

// displayedResults will be populated from GAS responses processed by computeTopResponders
// Use seconds (number) for the time-to-answer to avoid ambiguous Date conversions.
const finalResults = ref<{ name: string; timeSeconds: number | null }[]>([]);
const displayedResults = ref<{ name: string; timeSeconds: number | null }[]>([]);

// Helper: rank is determined by the finalResults order (ascending time)
function getRank(record: { name: string; timeSeconds: number | null }): number {
    const idx = finalResults.value.findIndex((r) => {
        if (r.name !== record.name) return false;
        const ta = r.timeSeconds;
        const tb = record.timeSeconds;
        // null-safe equality for numeric seconds
        return (ta === null && tb === null) || (typeof ta === 'number' && typeof tb === 'number' && Math.abs(ta - tb) < 1e-6);
    });
    return idx >= 0 ? idx + 1 : finalResults.value.length;
}

// (keep variable above) avoid duplicate declaration

function formatTime(seconds: number | null): string {
    if (seconds === null || typeof seconds !== 'number' || Number.isNaN(seconds)) return '-';
    if (seconds < 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds - mins * 60;
    const secsStr = secs.toFixed(3).replace(/\.000$/, '');
    if (mins > 0) {
        return `${mins}分${secsStr}秒`;
    }
    return `${secsStr}秒`;
}

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
    // fetch mapped responses and prepare finalResults, then animate
    fetchAndPrepare();
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
    const sorted = finalResults.value || [];
    // 最下位から順に上に積み上がるように表示（存在チェックを行う）
    for (let i = sorted.length - 1; i >= 3; i--) {
        const item = sorted[i];
        if (item) {
            displayedResults.value.unshift(item);
            await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒間隔
        }
    }
    // 上位3位は特別（存在する分だけ順に出す）
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待つ
    const topCount = Math.min(3, sorted.length);
    for (let j = topCount - 1; j >= 0; j--) {
        const item = sorted[j];
        if (item) {
            displayedResults.value.unshift(item);
            // small pause between each top placement
            await new Promise(resolve => setTimeout(resolve, 1000));
            // if this is the top (first place), play full screen particles
            if (j === 0) {
                showFullScreenParticles.value = true;
                setTimeout(() => showFullScreenParticles.value = false, 3000);
            }
        }
    }
}

function parseFormIdFromUrl(url: string | undefined | null): string | null {
    if (!url) return null;
    try {
        // try patterns like /d/e/{id}/ or /d/{id}/
        const m1 = url.match(/\/d\/e\/([a-zA-Z0-9_-]+)/);
        if (m1 && m1[1]) return m1[1];
        const m2 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m2 && m2[1]) return m2[1];
        // fallback: look for id= query param
        const qm = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (qm && qm[1]) return qm[1];
    } catch (e) {
        console.warn('parseFormIdFromUrl failed', e);
    }
    return null;
}

async function fetchAndPrepare() {
    // reset
    finalResults.value = [];
    displayedResults.value = [];

    try {
        const startQuizUseCase = container.resolve(StartQuizUseCase);
        const quiz = await startQuizUseCase.execute(route.params.id as string);
        const formId = parseFormIdFromUrl(quiz?.answerUrl ?? '');

        // determine quiz start time early, used by both real fetch and dummy data
        const quizStartMs = quizState.getStartTime() ?? Date.now();
        if (!quizState.getStartTime()) quizState.setStartTime(quizStartMs);

        if (!formId) {
            console.warn('Could not determine formId from quiz.answerUrl');
            return startRankingAnimation();
        }

        // obtain mapped responses: use dummy data in preview mode, otherwise call GAS
        let mapped: any[] = [];
        if (isPreview.value) {
            // build a small set of realistic dummy rows
            const optionText = quiz?.options?.find((o: any) => o.no === quiz?.correctNo)?.text ?? String(quiz?.correctNo ?? '');
            mapped = [
                { '回答': optionText, 'メールアドレス': 'tanaka@example.com', __timestampMs: quizStartMs + 5000, __rowIndex: 2, __raw: [], name: '田中 仁' },
                { '回答': optionText, 'メールアドレス': 'suzuki@example.com', __timestampMs: quizStartMs + 12000, __rowIndex: 3, __raw: [], name: '鈴木 太郎' },
                { '回答': optionText, 'メールアドレス': 'sato@example.com', __timestampMs: quizStartMs + 18000, __rowIndex: 4, __raw: [], name: '佐藤 花子' },
                { '回答': '不正解', 'メールアドレス': 'other@example.com', __timestampMs: quizStartMs + 25000, __rowIndex: 5, __raw: [], name: 'その他' },
            ];
        } else {
            const svc = new GasFunctionService('_quizGame_getMappedResponses');
            mapped = await svc.call<any[]>(formId);
        }

        // decide answerKey and correctValue heuristically
        let answerKey = '';
        let correctValue = String(quiz?.correctNo ?? '');
        const optionText = quiz?.options?.find(o => o.no === quiz?.correctNo)?.text;

        if (Array.isArray(mapped) && mapped.length > 0) {
            const sample = mapped[0];
            const candidateHeaders = Object.keys(sample).filter(h => !h.startsWith('__') && !/タイムスタンプ|timestamp|メール|email/i.test(h));
            let bestHeader = candidateHeaders[0] || Object.keys(sample)[0];
            let bestScore = -1;
            for (const h of candidateHeaders) {
                let score = 0;
                for (const r of mapped) {
                    const v = (r[h] ?? '') + '';
                    if (optionText && String(v) === String(optionText)) score++;
                    if (quiz?.correctNo !== undefined && String(v) === String(quiz.correctNo)) score++;
                }
                if (score > bestScore) { bestScore = score; bestHeader = h; }
            }
            answerKey = bestHeader;
            if (bestScore > 0) {
                correctValue = optionText ? String(optionText) : String(quiz?.correctNo ?? '');
            } else {
                answerKey = candidateHeaders[0] || Object.keys(sample).find(k => !k.startsWith('__')) || Object.keys(sample)[0];
                correctValue = optionText ? String(optionText) : String(quiz?.correctNo ?? '');
            }
        } else {
            // no mapped responses
            finalResults.value = [];
            return startRankingAnimation();
        }

        // normalize correctValue for robust comparison (strip numbering, NFKC, trim, casefold)
        const normalizedCorrect = normalizeAnswer(correctValue);

        const top = computeTopResponders(mapped, {
            answerKey,
            correctValue: normalizedCorrect,
            limit: 10,
            uniqueByEmail: true,
            excludeMissingEmail: true,
            quizStartTimeMs: quizStartMs,
        });

        finalResults.value = top.map(item => {
            const secs = (item as any).__timeToAnswerSec;
            const timeSeconds = typeof secs === 'number' && !Number.isNaN(secs) ? secs : null;
            return { name: item.name ?? '正答者なし ---', timeSeconds };
        });

        // start animation once finalResults prepared
        await startRankingAnimation();
    } catch (e) {
        console.error('Failed to fetch/process mapped responses', e);
        // still run animation with whatever is present
        await startRankingAnimation();
    }
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