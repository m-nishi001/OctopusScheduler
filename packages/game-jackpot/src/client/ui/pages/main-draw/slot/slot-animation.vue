<template>
    <div class="slot-container jp-frame" ref="container" :class="{ spinning }" :style="sizeVars">
        <div class="slot-reels">
            <div class="reel" v-for="(reel, index) in reels" :key="index">
                <div class="reel-content" :style="{ transform: `translateY(${reel.offset}px)` }">
                    <div v-for="prize in allPrizes" :key="prize.id" class="prize-item">
                        {{ prize.name }}
                    </div>
                </div>
            </div>
        </div>
        <div v-if="showResult" class="result">{{ selectedPrize?.name }}</div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useAudio } from '@octopus/composables/use-audio';
import '../../../theme/jackpot-theme.css';
import type { PrizeDto } from '@control/prize/dto/prize-dto';
import { defineExpose } from 'vue';
import type { AnimationRef } from './animation-types';

export default {
    name: 'SlotAnimation',
    props: {
        prizes: { type: Array as () => PrizeDto[], default: () => [] },
        selectedPrize: { type: Object as () => PrizeDto | null, default: null },
        showResult: { type: Boolean, default: false },
    },
    emits: ['stopped'],
    setup(props, { emit }) {
        const spinning = ref(false);
        const container = ref<HTMLElement | null>(null);
        let resizeObserver: ResizeObserver | null = null;
        let animationId: number | null = null;
        // useAudio を使って BGM を再生
        const { load: loadBgm, play: playBgm, stop: stopBgm } = useAudio({ mode: 'html-audio' });
        const reels = ref([
            { offset: 0, speed: 0 },
            { offset: 0, speed: 0 },
            { offset: 0, speed: 0 },
        ]);

        const allPrizes = computed(() => {
            const extended = [...props.prizes];
            while (extended.length < 10) {
                extended.push(...props.prizes);
            }
            return extended.slice(0, 10);
        });

        const itemHeight = ref(60);

        // 筐体の大きさは画面の高さに合わせる(投影の1080pでも見映えがするよう、既定60pxから拡大)。
        // リール内の位置計算(itemHeight)と見た目のCSS変数は同じ値を使う。
        const updateItemHeight = () => {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
            itemHeight.value = Math.max(64, Math.min(170, Math.round(vh * 0.13)));
        };

        const sizeVars = computed(() => ({
            '--slot-item-h': `${itemHeight.value}px`,
            '--slot-reel-h': `${itemHeight.value * 3}px`,
            '--slot-reel-w': `${Math.round(itemHeight.value * 2.6)}px`,
            '--slot-font': `${Math.round(itemHeight.value * 0.34)}px`,
        }));

        const startSpin = async (bgmUrl?: Blob | null) => {
            console.log('[SlotAnimation] startSpin: bgmUrl=', bgmUrl ? { size: bgmUrl.size, type: bgmUrl.type } : null);
            if (bgmUrl) {
                try {
                    await stopBgm();
                    await loadBgm(bgmUrl);
                    await playBgm({ isRepeat: true });
                } catch { /* ignore */ }
            }
            spinning.value = true;
            reels.value.forEach((reel, index) => {
                reel.speed = 10 + index * 2; // 少しずつ遅く
            });
        };

        const stopSpin = async (durationSec?: number, targetPrizeId?: string | null) => {
            return new Promise<string | null>((resolve) => {
                let stoppedCount = 0;
                const totalReels = reels.value.length;

                const stopReel = (index: number) => {
                    if (index >= totalReels) return;
                    setTimeout(() => {
                        reels.value[index].speed = 0;
                        const targetIndex = props.selectedPrize ? props.prizes.findIndex(p => p.id === props.selectedPrize!.id) : Math.floor(Math.random() * props.prizes.length);
                        const targetOffset = - (targetIndex * itemHeight.value);
                        reels.value[index].offset = targetOffset;
                        stoppedCount++;
                        if (stoppedCount === totalReels) {
                            spinning.value = false;
                            stopBgm().catch(() => { });
                            setTimeout(() => {
                                const prizeId = props.selectedPrize?.id || null;
                                emit('stopped', prizeId);
                                resolve(prizeId);
                            }, 1000);
                        } else {
                            stopReel(index + 1);
                        }
                    }, 500 * (index + 1));
                };
                stopReel(0);
            });
        };

        // runAutoReroll removed — use startSpin/stopSpin flow via parent orchestrator if needed

        // アニメーションループ
        const animate = () => {
            reels.value.forEach(reel => {
                if (reel.speed > 0) {
                    reel.offset -= reel.speed;
                    if (reel.offset <= - (allPrizes.value.length * itemHeight.value)) {
                        reel.offset = 0;
                    }
                }
            });
            animationId = requestAnimationFrame(animate);
        };

        onMounted(() => {
            updateItemHeight();
            resizeObserver = new ResizeObserver(() => {
                updateItemHeight();
            });
            if (container.value) {
                resizeObserver.observe(container.value);
            }
            animate();
        });

        onUnmounted(() => {
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            if (animationId !== null) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            stopBgm().catch(() => { });
        });

        defineExpose<AnimationRef>({
            startSpin,
            stopSpin,
        });

        return { spinning, reels, allPrizes, sizeVars };
    }
};
</script>

<style scoped>
.slot-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(24px, 4vh, 48px);
}

.slot-reels {
    display: flex;
    gap: clamp(14px, 2vh, 28px);
    margin-bottom: 20px;
}

.reel {
    width: var(--slot-reel-w, 120px);
    height: var(--slot-reel-h, 180px);
    background: #000;
    border: 3px solid #FFD700;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
}

.reel-content {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    transition: transform 0.1s ease-out;
}

.prize-item {
    height: var(--slot-item-h, 60px);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFD700;
    font-weight: bold;
    font-size: var(--slot-font, 18px);
    padding: 0 8px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.8);
    border-bottom: 1px solid #FFD700;
}

.spinning .reel-content {
    transition: none;
}

.result {
    font-size: calc(var(--slot-font, 18px) * 1.5);
    color: #FFD700;
    font-weight: bold;
    text-shadow: 0 0 15px #FFD700;
    background: rgba(0, 0, 0, 0.8);
    padding: 10px 20px;
    border-radius: 10px;
    border: 2px solid #FFD700;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    animation: resultPop 0.5s ease-out;
}

@keyframes resultPop {
    0% {
        transform: scale(0);
        opacity: 0;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>