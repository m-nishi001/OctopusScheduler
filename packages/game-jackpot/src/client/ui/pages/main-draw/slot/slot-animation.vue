<template>
    <div class="slot-container jp-frame" ref="container" :class="{ spinning, hit }" :style="sizeVars">
        <div class="slot-reels">
            <div class="reel" v-for="(reel, index) in reels" :key="index" :class="{ landed: landed[index] }">
                <div class="reel-content" :style="{ transform: `translateY(${-(reel.position + reel.offset)}px)` }">
                    <div v-for="slot in strips[index]" :key="slot.key" class="prize-item">
                        <span class="prize-name">{{ slot.name }}</span>
                    </div>
                </div>
                <!-- 当たりの行(真ん中)。全部止まったあと、金色に光らせる -->
                <div class="win-row"></div>
            </div>
        </div>
        <!-- 結果は枠の下の方に重ねて出す(場所を空けておかないので、枠の下に空白ができず、出ても何も動かない) -->
        <div class="result-area">
            <div v-if="showResult" class="result">{{ selectedPrize?.name }}</div>
        </div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import type { PropType } from 'vue';
import { useAudio } from '@octopus/composables/use-audio';
import '../../../theme/jackpot-theme.css';
import type { PrizeDto } from '@control/prize/dto/prize-dto';
import type { AnimationItem, AnimationRef } from '../animation-types';
import {
    advancePosition, buildReelLoop, computeSlotSize, cycleHeight, planStop, positionAtStop, renderedCount,
    settleOffset, spinSpeed, stopSchedule, wrapPosition, DEFAULT_STOP_TOTAL_MS,
} from './reel-model';
import type { Rng, StopPlan } from './reel-model';

/** 止まってから結果を見せ続ける時間(ms)。 */
const HOLD_AFTER_STOP_MS = 2000;
/** 止まった直後にリールが光る時間(ms)。 */
const LANDED_FLASH_MS = 600;
const REEL_COUNT = 3;

export default {
    name: 'SlotAnimation',
    props: {
        prizes: { type: Array as () => PrizeDto[], default: () => [] },
        /** ルーレットと同じ、この抽選のために用意した景品(当選景品 + ダミー)。あれば、全景品ではなくこれを流す。 */
        preparedPrizes: { type: Array as () => AnimationItem[], default: () => [] },
        selectedPrize: { type: Object as () => PrizeDto | null, default: null },
        showResult: { type: Boolean, default: false },
        /** リールの並びを決める乱数。テストでは決まった列を渡す。 */
        rng: { type: Function as PropType<Rng>, default: () => Math.random() },
    },
    emits: ['stopped'],
    setup(props, { emit, expose }) {
        const spinning = ref(false);
        const container = ref<HTMLElement | null>(null);
        let animationId: number | null = null;
        // useAudio を使って BGM を再生
        const { load: loadBgm, play: playBgm, stop: stopBgm } = useAudio();
        // position は「上へ流れた距離(px)」。ループ1周で元に戻る(位置計算は reel-model.ts)。
        // offset は止まった直後の跳ね返り(行き過ぎて戻る分)。position は常に止まる位置ぴったりのまま。
        const reels = ref(Array.from({ length: REEL_COUNT }, () => ({ position: 0, speed: 0, offset: 0 })));
        // 全部止まってから結果を見せ続けている間、当たりの行を光らせる印 / 止まった直後のリールの光
        const hit = ref(false);
        const landed = ref<boolean[]>(Array.from({ length: REEL_COUNT }, () => false));
        // 止まった時刻(跳ね返りの経過時間を求める。跳ね返っていないリールは null)
        const settledAt: Array<number | null> = Array.from({ length: REEL_COUNT }, () => null);
        let stopTimers: Array<ReturnType<typeof setTimeout>> = [];
        const clearStopTimers = () => {
            stopTimers.forEach(clearTimeout);
            stopTimers = [];
        };
        const prefersReducedMotion = () =>
            typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        // 止め始めたリールの減速の計画(止まったら null)。描画のたびに時刻から位置を求める。
        const stopPlans: Array<(StopPlan & { startedAt: number }) | null> = Array.from({ length: REEL_COUNT }, () => null);

        // 流す景品。確変の間は、親が updatePrizes で差し替えた一覧(当選景品を複製したもの)。
        // 通常は、ルーレットと同じ用意済みの景品(当選景品 + ダミー)。まだ用意できていなければ全景品。
        // 用意済みの景品は抽選のたびに選ばれるので、全景品を流すよりも、当選済みの景品が混ざりにくい。
        const items = ref<ReadonlyArray<AnimationItem> | null>(null);
        const source = computed<ReadonlyArray<AnimationItem>>(() => {
            if (items.value) return items.value;
            const base: ReadonlyArray<AnimationItem> = props.preparedPrizes.length > 0 ? props.preparedPrizes : props.prizes;
            return base.map(({ id, name }) => ({ id, name }));
        });

        // リールごとに別の並び(同じ名前が隣り合わない)。景品が変わったときと、回し始めるたびに組み直す。
        const loops = ref<AnimationItem[][]>(Array.from({ length: REEL_COUNT }, () => []));
        const rebuildLoops = () => {
            loops.value = reels.value.map(() => buildReelLoop(source.value, props.rng));
        };
        // 同じ景品の並びが再び渡されただけ(確変の途中で親が同じ一覧を入れ直す)なら、回っている最中に並びを変えない。
        watch(
            source,
            (now, before) => {
                const same = before && now.length === before.length && now.every((it, i) => it.id === before[i].id);
                if (!same) rebuildLoops();
            },
            { immediate: true }
        );
        // 描画は「ループ + 窓の高さ分」。窓が帯の外(黒)を映さないので、1周の継ぎ目が見えない。
        const strips = computed(() =>
            loops.value.map((loop) =>
                Array.from({ length: renderedCount(loop.length) }, (_, k) => ({ key: k, name: loop[k % loop.length].name }))
            )
        );

        // 大きさは窓の大きさだけから決める(自分の大きさを測らないので、揺れ戻しが起きない)。
        const readViewport = () =>
            typeof window !== 'undefined'
                ? { width: window.innerWidth, height: window.innerHeight }
                : { width: 1280, height: 720 };
        const size = ref(computeSlotSize(readViewport().width, readViewport().height));
        const itemHeight = computed(() => size.value.itemHeight);
        const updateSize = () => {
            const { width, height } = readViewport();
            size.value = computeSlotSize(width, height);
        };
        // マスの高さが変わったら、位置・速さ・減速の計画も同じ比率で直す(止まっている景品がずれない)
        watch(itemHeight, (now, before) => {
            const k = now / before;
            reels.value.forEach((reel, i) => {
                reel.position *= k;
                reel.speed *= k;
                const plan = stopPlans[i];
                if (plan) {
                    plan.from *= k;
                    plan.to *= k;
                }
            });
        });

        const sizeVars = computed(() => ({
            '--slot-item-h': `${size.value.itemHeight}px`,
            '--slot-reel-h': `${size.value.itemHeight * 3}px`,
            '--slot-reel-w': `${size.value.reelWidth}px`,
            '--slot-font': `${size.value.font}px`,
            '--slot-gap': `${size.value.gap}px`,
            '--slot-pad': `${size.value.padding}px`,
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
            rebuildLoops();
            clearStopTimers();
            hit.value = false;
            spinning.value = true;
            reels.value.forEach((reel, index) => {
                stopPlans[index] = null;
                settledAt[index] = null;
                reel.offset = 0;
                landed.value[index] = false;
                reel.speed = spinSpeed(index, itemHeight.value); // 速く、リールごとに少しずつ違う速さ
            });
        };

        const updatePrizes = (next: ReadonlyArray<AnimationItem>) => {
            items.value = next.map(({ id, name }) => ({ id, name }));
        };
        const getInternalItems = () => source.value;

        // 止める景品は、止め始める前に決めて確かめる。演出の中に無い景品を黙って別の景品に置き換えると、
        // 画面の当選と保存した抽選結果が食い違うので、例外にする。
        // 左 → 中 → 右の順に減速して止まる(時刻は stopSchedule)。どのリールも、自分の減速が始まるまでは全速で回り続ける。
        // 減速の計画は、そのリールが減速を始める瞬間の位置と速さから立てる。右のリールが一番ゆっくり、粘って止まる。
        // どのリールも別の並びなので、先に止まったリールを見ても、他のリールの並びからは当選景品を見分けられない。
        // 全体の長さは、親の指定する時間 `durationSec`(秒。管理画面の設定)。無ければ既定。`occurrence` は使わない。
        const stopSpin = async (durationSec?: number, targetPrizeId?: string | null) => {
            const targetId = targetPrizeId ?? props.selectedPrize?.id ?? null;
            if (targetId === null || loops.value.some((loop) => !loop.some((item) => item.id === targetId))) {
                throw new Error(`スロットに、止める景品(${targetId ?? '指定なし'})がありません`);
            }
            const totalMs = durationSec && durationSec > 0 ? durationSec * 1000 : DEFAULT_STOP_TOTAL_MS;
            const schedule = stopSchedule(totalMs);
            clearStopTimers();
            return new Promise<string | null>((resolve) => {
                let stoppedCount = 0;
                const beginDecel = (index: number) => {
                    const reel = reels.value[index];
                    const plan = planStop({
                        loop: loops.value[index],
                        targetId,
                        position: reel.position,
                        itemHeight: itemHeight.value,
                        speedPerFrame: reel.speed || spinSpeed(index, itemHeight.value),
                        durationMs: schedule[index].endMs - schedule[index].startMs,
                    })!; // 景品がループにあることは上で確かめてある
                    reel.speed = 0;
                    stopPlans[index] = { ...plan, startedAt: Date.now() };
                };
                const land = (index: number) => {
                    const reel = reels.value[index];
                    // 計画の終点にぴったり合わせる(時刻のずれで半端な位置に止まらない)
                    const cycle = cycleHeight(loops.value[index].length, itemHeight.value);
                    reel.position = wrapPosition(stopPlans[index]?.to ?? reel.position, cycle);
                    stopPlans[index] = null;
                    if (!prefersReducedMotion()) settledAt[index] = Date.now();
                    landed.value[index] = true;
                    stopTimers.push(setTimeout(() => { landed.value[index] = false; }, LANDED_FLASH_MS));
                    stoppedCount++;
                    if (stoppedCount === reels.value.length) {
                        spinning.value = false;
                        hit.value = true;
                        stopBgm().catch(() => { });
                        stopTimers.push(setTimeout(() => {
                            emit('stopped', targetId);
                            resolve(targetId);
                        }, HOLD_AFTER_STOP_MS));
                    }
                };
                schedule.forEach(({ startMs, endMs }, index) => {
                    if (startMs <= 0) beginDecel(index);
                    else stopTimers.push(setTimeout(() => beginDecel(index), startMs));
                    stopTimers.push(setTimeout(() => land(index), endMs));
                });
            });
        };

        // アニメーションループ
        const animate = () => {
            const now = Date.now();
            reels.value.forEach((reel, index) => {
                const cycle = cycleHeight(loops.value[index].length, itemHeight.value);
                const plan = stopPlans[index];
                if (plan) reel.position = wrapPosition(positionAtStop(plan, now - plan.startedAt), cycle);
                else if (reel.speed > 0) reel.position = advancePosition(reel.position, reel.speed, cycle);
                const settled = settledAt[index];
                reel.offset = settled === null ? 0 : settleOffset(now - settled, itemHeight.value);
                if (settled !== null && reel.offset === 0 && now - settled > 0) settledAt[index] = null;
            });
            animationId = requestAnimationFrame(animate);
        };

        onMounted(() => {
            updateSize();
            window.addEventListener('resize', updateSize);
            animate();
        });

        onUnmounted(() => {
            window.removeEventListener('resize', updateSize);
            clearStopTimers();
            if (animationId !== null) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            stopBgm().catch(() => { });
        });

        // Options API の setup() では defineExpose は使えない(何もしない)ので、context の expose を使う。
        // これが無いと親から startSpin/stopSpin が見えず、景品抽選を開始しても何も動かない。
        expose({ startSpin, stopSpin, updatePrizes, getInternalItems } satisfies AnimationRef);

        return { spinning, hit, landed, reels, strips, sizeVars, container };
    }
};
</script>

<style scoped>
/* 大きさは --slot-* (窓の大きさから計算)で決まる。ルーレットと同じくらい画面を使い、遠くからでも読める */
.slot-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    max-width: 100%;
    padding: var(--slot-pad, 24px);
}

.slot-reels {
    display: flex;
    gap: var(--slot-gap, 14px);
}

.reel {
    width: var(--slot-reel-w, 120px);
    height: var(--slot-reel-h, 180px);
    background: #000;
    border: 3px solid #FFD700;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
    flex: none;
}

.reel-content {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    /* 位置は JS が毎フレーム決める。CSS の移動(transition)を入れると、最後のリールが止まって .spinning が外れた瞬間に
       0.1秒の滑りが入り、その間は止まった景品が窓の一番上からずれて見える(遅い端末では長引く) */
    transition: none;
}

.prize-item {
    height: var(--slot-item-h, 60px);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFD700;
    font-weight: bold;
    font-size: var(--slot-font, 18px);
    line-height: 1.15;
    padding: 0 calc(var(--slot-item-h, 60px) * 0.06);
    text-align: center;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.8);
    border-bottom: 1px solid #FFD700;
}

/* 長い名前は2行まで折り返し、それでも入らなければ省略する */
.prize-name {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
    max-width: 100%;
}

/* 結果は、リールの下の行に重ねて出す。当たりの行(真ん中)は隠さない */
.result-area {
    position: absolute;
    left: var(--slot-pad, 24px);
    right: var(--slot-pad, 24px);
    bottom: calc(var(--slot-pad, 24px) + var(--slot-item-h, 60px) * 0.08);
    display: flex;
    justify-content: center;
    pointer-events: none;
}

/* 当たりの行。止まったあとの間だけ、金色の光が脈打つ */
.win-row {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--slot-item-h, 60px);
    height: var(--slot-item-h, 60px);
    box-sizing: border-box;
    pointer-events: none;
    opacity: 0;
}

.hit .win-row {
    opacity: 1;
    border-top: 3px solid #FFE680;
    border-bottom: 3px solid #FFE680;
    background: rgba(255, 215, 0, 0.18);
    box-shadow: inset 0 0 18px rgba(255, 215, 0, 0.9), 0 0 18px rgba(255, 215, 0, 0.9);
    animation: winPulse 0.7s ease-in-out infinite alternate;
}

@keyframes winPulse {
    0% {
        opacity: 0.55;
    }

    100% {
        opacity: 1;
    }
}

/* リールが止まった瞬間の光 */
.reel.landed {
    animation: reelFlash 0.6s ease-out;
}

@keyframes reelFlash {
    0% {
        box-shadow: 0 0 0 rgba(255, 215, 0, 0), inset 0 0 0 rgba(255, 215, 0, 0);
        border-color: #FFF4B0;
    }

    30% {
        box-shadow: 0 0 28px rgba(255, 230, 128, 1), inset 0 0 22px rgba(255, 230, 128, 0.9);
        border-color: #FFF4B0;
    }

    100% {
        box-shadow: 0 0 0 rgba(255, 215, 0, 0), inset 0 0 0 rgba(255, 215, 0, 0);
        border-color: #FFD700;
    }
}

.result {
    box-sizing: border-box;
    max-width: 100%;
    font-size: calc(var(--slot-font, 18px) * 1.5);
    line-height: 1.25;
    color: #FFD700;
    font-weight: bold;
    text-align: center;
    text-shadow: 0 0 15px #FFD700;
    background: rgba(0, 0, 0, 0.8);
    padding: 10px 20px;
    border-radius: 10px;
    border: 2px solid #FFD700;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    overflow-wrap: anywhere;
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

/* 動きを減らす設定: 光の点滅・パルスは止め、光りっぱなしにする */
@media (prefers-reduced-motion: reduce) {
    .hit .win-row {
        animation: none;
    }

    .reel.landed {
        animation: none;
    }

    .result {
        animation: none;
    }
}
</style>
