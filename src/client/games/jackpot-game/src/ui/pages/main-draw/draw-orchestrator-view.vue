<template>
    <MainLayout>
        <div class="orchestrator container mx-auto p-6">
            <div class="header flex items-start justify-between mb-6">
                <div>
                    <h2 class="text-2xl font-bold">ジャックポッド抽選（本抽選）</h2>
                    <p class="mt-1 text-sm text-gray-600">mode: {{ mode }} • Enterで操作（開始 / 停止 / 続行）</p>
                </div>
                <div class="controls">
                    <button @click="start" class="btn-primary">開始</button>
                </div>
            </div>

            <!-- Half remaining modal -->
            <div v-if="showHalfModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div class="bg-white rounded p-6 w-96 text-center">
                    <h3 class="text-xl font-bold mb-2">残り半分です！</h3>
                    <p class="mb-4">残りの景品が半分になりました。続行するには Enter を押してください。</p>
                    <div class="mt-2">
                        <button class="btn-primary" @click="showHalfModal = false">Enter で続行</button>
                    </div>
                </div>
            </div>

            <!-- End modal -->
            <div v-if="showEndModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div class="bg-white rounded p-6 w-96 text-center">
                    <h3 class="text-xl font-bold mb-2">抽選は終了しました</h3>
                    <p class="mb-4">全ての景品が配布されました。Enter を押すと結果画面へ移動します。</p>
                    <div class="mt-2">
                        <button class="btn-primary" @click="showEndModal = false">Enter で続行</button>
                    </div>
                </div>
            </div>

            <!-- Member winner modal -->
            <div v-if="showMemberWinnerModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div class="bg-white rounded p-6 w-96 text-center">
                    <h3 class="text-xl font-bold mb-2">当選者発表</h3>
                    <p class="mb-4">当選者: <strong>{{ latestResult?.member }}</strong></p>
                    <div class="mt-2">
                        <button class="btn-primary" @click="showMemberWinnerModal = false">Enter で続行</button>
                    </div>
                </div>
            </div>

            <!-- Prize winner modal -->
            <div v-if="showPrizeWinnerModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div class="bg-white rounded p-6 w-96 text-center">
                    <h3 class="text-xl font-bold mb-2">景品当選</h3>
                    <p class="mb-4">当選景品: <strong>{{ latestResult?.prize }}</strong></p>
                    <div class="mt-2">
                        <button class="btn-primary" @click="showPrizeWinnerModal = false">Enter で続行</button>
                    </div>
                </div>
            </div>

            <div v-if="mode === 'rich'" class="rich-layout">
                <!-- Members row -->
                <section class="member-area mb-6" v-if="currentPhase === 'member'">
                    <div class="member-stage mx-auto">
                        <div class="stage-frame">
                            <MemberDrawAnimation ref="memberAnimRef" :members="members" />
                        </div>

                        <div class="start-box" role="button" tabindex="0" @click="memberStart">
                            <div class="start-label">START!!</div>
                        </div>
                    </div>
                </section>

                <!-- Result + Roulette centered -->
                <section v-if="currentPhase === 'prize'"
                    class="center-area grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div class="result-panel col-span-1 md:col-span-1 bg-white/80 rounded p-4 shadow">
                        <h4 class="font-semibold mb-2">直近の当選</h4>
                        <div v-if="latestResult">
                            <p class="text-sm">メンバー: <strong>{{ latestResult.member }}</strong></p>
                            <p class="text-sm">景品: <strong>{{ latestResult.prize || '（未決定）' }}</strong></p>
                        </div>
                        <div v-else class="text-sm text-gray-500">まだ抽選が実行されていません。開始ボタン、または Enter を押してください。</div>
                    </div>

                    <div class="roulette-panel col-span-1 md:col-span-1 flex items-center justify-center"
                        v-if="currentPhase === 'prize'">
                        <RouletteAnimation ref="rouletteRef" :prizes="prizes" :selectedPrize="selectedPrize"
                            :showResult="showPrizeResult" />
                    </div>

                    <div class="guide-panel col-span-1 md:col-span-1 bg-white/80 rounded p-4 shadow">
                        <h4 class="font-semibold mb-2">操作ガイド</h4>
                        <ul class="text-sm list-disc pl-5 text-gray-700">
                            <li>Enter: 抽選開始 / 停止 / 続行</li>
                            <li>最初にメンバー抽選 → 次に景品抽選 の順。</li>
                            <li>残り半分になると警告モーダルが表示されます。</li>
                        </ul>
                    </div>
                </section>
            </div>

            <div v-else>
                <div class="simple-area bg-white/80 rounded p-4">
                    <h3 class="font-semibold">簡易抽選モード</h3>
                    <p v-if="latestResult">当選: {{ latestResult.member }} — 賞品: {{ latestResult.prize }}</p>
                </div>
            </div>
        </div>
    </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import MemberDrawAnimation from './MemberDrawAnimation.vue';
import RouletteAnimation from './RouletteAnimation.vue';
import { usePrizesAndMembers } from '../../composables/usePrizesAndMembers';
import { waitForEnter } from '../../composables/useEnterKey';
import DrawAdapter from '../../../model/adapters/draw-adapter';
import { container } from 'tsyringe';

export default {
    name: 'DrawOrchestratorPage',
    components: { MainLayout, MemberDrawAnimation, RouletteAnimation },
    props: {
        mode: { type: String as () => 'simple' | 'rich', default: 'rich' }
    },
    setup(props: any) {
        const { prizes, members, fetchPrizes, fetchMembers } = usePrizesAndMembers();
        const latestResult = ref<any | null>(null);
        const memberAnimRef = ref<any>(null);
        const rouletteRef = ref<any>(null);
        const selectedPrize = ref<any | null>(null);
        const showPrizeResult = ref(false);
        const isRunning = ref(false);
        const halfModalShown = ref(false);
        const showHalfModal = ref(false);
        const showEndModal = ref(false);
        const totalPrizes = ref<number | null>(null);
        const currentPhase = ref<'member' | 'prize' | 'idle'>('member');
        const showMemberWinnerModal = ref(false);
        const showPrizeWinnerModal = ref(false);
        const plannedPrizeRes = ref<any | null>(null);

        const memberAnimating = ref(false);
        const prizeAnimating = ref(false);

        onMounted(async () => {
            await fetchPrizes();
            await fetchMembers();

            const handler = (ev: KeyboardEvent) => {
                if (ev.key !== 'Enter') return;
                // Use microtask to call async handlers without blocking
                if (currentPhase.value === 'member') {
                    if (!memberAnimating.value) {
                        void memberStart();
                        memberAnimating.value = true;
                    } else {
                        void memberStop();
                        memberAnimating.value = false;
                    }
                } else if (currentPhase.value === 'prize') {
                    if (!prizeAnimating.value) {
                        void prizeStart();
                        prizeAnimating.value = true;
                    } else {
                        void prizeStop();
                        prizeAnimating.value = false;
                    }
                }
            };

            window.addEventListener('keydown', handler);
            onUnmounted(() => window.removeEventListener('keydown', handler));
        });

        const start = async () => {
            if (props.mode === 'simple') {
                // simple: call a single full draw and display result (press Enter to continue)
                const res = await DrawAdapter.executeFullDraw();
                // adapter may return different shapes; be defensive
                latestResult.value = (res && res.member) ? res : { member: res?.member || 'unknown', prize: res?.prize || 'unknown' };
                try {
                    await waitForEnter();
                } catch (e) { }
                // navigation or next step can be handled by caller
                return;
            }

            // Rich mode: initialize and show member phase only. Use explicit start/stop handlers.
            isRunning.value = true;
            try {
                try {
                    const svc = container.resolve<any>('DrawService');
                    const count = await svc.getLastPrizeCount();
                    totalPrizes.value = count.total;
                } catch (e) {
                    totalPrizes.value = prizes.value.length || null;
                }
                currentPhase.value = 'member';
            } catch (e) {
                // ignore init errors
            }
        };

        // Event-driven handlers (A: explicit start/stop API)
        const memberStart = async () => {
            if (!isRunning.value) await start();
            // request member draw from service
            const memberRes = await DrawAdapter.executeMemberDraw({ requestCount: 10 });
            const plannedId = memberRes?.winnerId || memberRes?.winner || null;
            plannedPrizeRes.value = null;
            // start member animation
            if (memberAnimRef.value?.start) memberAnimRef.value.start();
            // attach planned id so child stopAt can align
            if (memberAnimRef.value) (memberAnimRef.value as any).__plannedWinner = plannedId;
        };

        const memberStop = async () => {
            // stop animation and determine winner
            let stopped: string | null = null;
            if (memberAnimRef.value?.stopAt) {
                try { stopped = await memberAnimRef.value.stopAt((memberAnimRef.value as any).__plannedWinner || null); } catch (e) { stopped = (memberAnimRef.value as any).__plannedWinner || null; }
            } else {
                stopped = (memberAnimRef.value as any).__plannedWinner || null;
            }
            latestResult.value = { member: members.value.find((m: any) => m.id === stopped)?.name || stopped, prize: '' };
            // show member winner modal
            showMemberWinnerModal.value = true;
            // prepare prize draw (pre-fetch) so prize UI knows what animation to show
            try { plannedPrizeRes.value = await DrawAdapter.executePrizeDraw({ memberId: stopped, requestCount: 8 }); } catch (e) { plannedPrizeRes.value = null; }
            // switch to prize phase after winner modal is closed by user
            currentPhase.value = 'prize';
        };

        const prizeStart = async () => {
            if (!plannedPrizeRes.value) {
                // fallback: fetch now
                plannedPrizeRes.value = await DrawAdapter.executePrizeDraw({ memberId: latestResult.value?.member || null, requestCount: 8 });
            }
            const prizeRes = plannedPrizeRes.value;
            if (prizeRes && prizeRes.isKakuhen && rouletteRef.value?.runAutoReroll) {
                // kakuhen auto reroll visual
                const dummy = prizeRes.dummyPrizeIds && prizeRes.dummyPrizeIds[0];
                const final = prizeRes.reservedPrizeIds && prizeRes.reservedPrizeIds[0];
                try {
                    const prizeId = await rouletteRef.value.runAutoReroll({ dummyPrizeId: dummy, finalPrizeId: final, bgm1Url: null, bgm2Url: null });
                    latestResult.value.prize = prizeId || final || null;
                    showPrizeWinnerModal.value = true;
                } catch (e) { /* ignore */ }
            } else {
                // normal: instruct roulette to spin toward selectedPrize when stopping
                selectedPrize.value = prizes.value.find((p: any) => p.id === (prizeRes?.winnerPrizeId || prizeRes?.prizeId)) || null;
                showPrizeResult.value = true;
                if (rouletteRef.value?.startSpin) rouletteRef.value.startSpin();
            }
        };

        const prizeStop = async () => {
            // stop roulette and show prize winner
            let prizeId: string | null = null;
            if (rouletteRef.value?.stopSpin) {
                const target = plannedPrizeRes.value?.winnerPrizeId || plannedPrizeRes.value?.prizeId || null;
                const idx = target ? prizes.value.findIndex((p: any) => p.id === target) : null;
                try { prizeId = await rouletteRef.value.stopSpin({ targetIndex: idx !== null && idx >= 0 ? idx : null, isFinal: true }); } catch (e) { prizeId = target; }
            } else {
                prizeId = plannedPrizeRes.value?.winnerPrizeId || plannedPrizeRes.value?.prizeId || null;
            }
            latestResult.value.prize = prizeId || plannedPrizeRes.value?.winnerPrizeId || null;
            showPrizeWinnerModal.value = true;

            // after prize modal closed, check remaining and transition
            try {
                const svc = container.resolve<any>('DrawService');
                const cnt = await svc.getLastPrizeCount();
                if (cnt.remaining <= 0) {
                    showEndModal.value = true;
                } else if (!halfModalShown.value && totalPrizes.value && cnt.remaining <= Math.floor(totalPrizes.value / 2)) {
                    showHalfModal.value = true;
                    halfModalShown.value = true;
                }
            } catch (e) { /* ignore */ }

            // after handling, go back to member phase
            currentPhase.value = 'member';
            // clear visual selection
            showPrizeResult.value = false;
            selectedPrize.value = null;
            plannedPrizeRes.value = null;
        };

        // legacy memberStart removed; new memberStart/prizeStart handlers above are event-driven

        return { prizes, members, latestResult, start, memberAnimRef, rouletteRef, selectedPrize, showPrizeResult, showHalfModal, showEndModal, currentPhase, showMemberWinnerModal, showPrizeWinnerModal, memberStart, memberStop, prizeStart, prizeStop, plannedPrizeRes };
    }
};
</script>

<style scoped>
.orchestrator {
    max-width: 1024px;
}

.btn-primary {
    background: linear-gradient(90deg, #6d28d9, #ec4899);
    color: white;
    padding: 8px 14px;
    border-radius: 6px;
}

/* Layout tweaks for draw screen */
.rich-layout .member-area {
    min-height: 140px;
}

.member-box {
    overflow: hidden;
}

.member-stage {
    max-width: 900px;
    margin: 0 auto;
    padding: 28px 20px 40px 20px;
}

.stage-frame {
    background: #0b0b0b;
    border: 2px solid rgba(255, 255, 255, 0.12);
    padding: 36px 12px 26px 12px;
    border-radius: 6px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
}

.stage-frame .member-draw {
    max-width: 840px;
    height: 260px;
}

.start-box {
    width: 160px;
    height: 44px;
    margin: 18px auto 0 auto;
    border: 2px solid rgba(255, 255, 255, 0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: transparent;
}

.start-box .start-label {
    color: #fff;
    font-weight: 700;
    letter-spacing: 1.2px;
}

.center-area {
    align-items: start;
}

.roulette-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 480px;
}

.result-panel,
.guide-panel {
    min-height: 220px;
}

/* Modal styles already semi-handled by utility classes, add center stacking */
.fixed.inset-0.z-50 {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
