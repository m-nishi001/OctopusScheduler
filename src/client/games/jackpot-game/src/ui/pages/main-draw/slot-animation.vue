<template>
    <div class="slot-container" :class="{ spinning }">
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
import { ref, onMounted, computed } from 'vue';
import type { PrizeDto } from '@model/applications/prize/dto/prize-dto';
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
        let bgmAudio: HTMLAudioElement | null = null;
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

        const itemHeight = 60;

        const startSpin = (bgmAssetUrl?: string | null) => {
            if (bgmAssetUrl) {
                if (bgmAudio) bgmAudio.pause();
                bgmAudio = new Audio(bgmAssetUrl);
                bgmAudio.loop = true;
                bgmAudio.play().catch(() => { });
            }
            spinning.value = true;
            reels.value.forEach((reel, index) => {
                reel.speed = 10 + index * 2; // 少しずつ遅く
            });
        };

        const stopSpin = async (_opts?: { decelerationFunction?: (elapsed: number, totalTime: number, initialSpeed: number) => number }) => {
            return new Promise<string | null>((resolve) => {
                let stoppedCount = 0;
                const totalReels = reels.value.length;

                const stopReel = (index: number) => {
                    if (index >= totalReels) return;
                    setTimeout(() => {
                        reels.value[index].speed = 0;
                        const targetIndex = props.selectedPrize ? props.prizes.findIndex(p => p.id === props.selectedPrize!.id) : Math.floor(Math.random() * props.prizes.length);
                        const targetOffset = - (targetIndex * itemHeight);
                        reels.value[index].offset = targetOffset;
                        stoppedCount++;
                        if (stoppedCount === totalReels) {
                            spinning.value = false;
                            if (bgmAudio) {
                                bgmAudio.pause();
                                bgmAudio = null;
                            }
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

        const runAutoReroll = async (opts: { dummyPrizeId: string | null; finalPrizeId: string | null; dummyDuration: number; finalDuration: number; bgm1Url: string | null; bgm2Url: string | null }) => {
            // シンプルに実装: ダミースピン後、最終停止
            if (opts.bgm1Url) {
                if (bgmAudio) bgmAudio.pause();
                bgmAudio = new Audio(opts.bgm1Url);
                bgmAudio.play().catch(() => { });
            }
            spinning.value = true;
            reels.value.forEach(reel => reel.speed = 10);
            await new Promise(resolve => setTimeout(resolve, opts.dummyDuration));
            spinning.value = false;
            // ダミー停止
            if (opts.dummyPrizeId) {
                const targetIndex = props.prizes.findIndex(p => p.id === opts.dummyPrizeId);
                reels.value.forEach(reel => reel.offset = - (targetIndex * itemHeight));
            }
            emit('stopped', opts.dummyPrizeId);

            await new Promise(resolve => setTimeout(resolve, 1000));

            if (opts.bgm2Url) {
                if (bgmAudio) bgmAudio.pause();
                bgmAudio = new Audio(opts.bgm2Url);
                bgmAudio.play().catch(() => { });
            }
            spinning.value = true;
            reels.value.forEach(reel => reel.speed = 10);
            await new Promise(resolve => setTimeout(resolve, opts.finalDuration));
            spinning.value = false;
            if (opts.finalPrizeId) {
                const targetIndex = props.prizes.findIndex(p => p.id === opts.finalPrizeId);
                reels.value.forEach(reel => reel.offset = - (targetIndex * itemHeight));
            }
            emit('stopped', opts.finalPrizeId);
        };

        // アニメーションループ
        const animate = () => {
            reels.value.forEach(reel => {
                if (reel.speed > 0) {
                    reel.offset -= reel.speed;
                    if (reel.offset <= - (allPrizes.value.length * itemHeight)) {
                        reel.offset = 0;
                    }
                }
            });
            requestAnimationFrame(animate);
        };

        onMounted(() => {
            animate();
        });

        defineExpose<AnimationRef>({
            startSpin,
            stopSpin,
            runAutoReroll,
        });

        return { spinning, reels, allPrizes };
    }
};
</script>

<style scoped>
.slot-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(180deg, #000 0%, #222 50%, #000 100%);
    padding: 30px;
    border-radius: 20px;
    box-shadow: 0 0 50px rgba(255, 215, 0, 0.8);
    border: 5px solid #FFD700;
}

.slot-reels {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
}

.reel {
    width: 120px;
    height: 180px;
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
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFD700;
    font-weight: bold;
    font-size: 18px;
    background: rgba(0, 0, 0, 0.8);
    border-bottom: 1px solid #FFD700;
}

.spinning .reel-content {
    transition: none;
}

.result {
    font-size: 28px;
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