<template>
    <MainLayout>
        <div class="orchestrator container mx-auto p-6">
            <div class="header flex items-start justify-between mb-6">
                <div>
                    <h2 class="text-2xl font-bold">ジャックポッド抽選（本抽選）</h2>
                    <p class="mt-1 text-sm text-gray-600">Enterで操作（開始 / 停止 / 続行）</p>
                </div>
                <div class="controls">
                    <button @click="start" class="btn-primary">開始</button>
                </div>
            </div>

            <DrawResultDialog v-if="modalState === 'half'" title="残り半分です！"
                :message="'残りの景品が半分になりました。続行するには Enter を押してください。'" @close="modalState = null" />

            <DrawResultDialog v-if="modalState === 'end'" title="抽選は終了しました"
                :message="'全ての景品が配布されました。Enter を押すと結果画面へ移動します。'" @close="modalState = null" />

            <DrawResultDialog v-if="modalState === 'memberWinner'" title="当選者発表" :imageUrl="memberImageUrl"
                primaryLabel="Enter で続行" @close="modalState = null">
                当選者: <strong>{{ latestResult?.member }}</strong>
            </DrawResultDialog>

            <DrawResultDialog v-if="modalState === 'prizeWinner'" title="景品当選" :imageUrl="prizeImageUrl"
                primaryLabel="Enter で続行" @close="modalState = null">
                当選景品: <strong>{{ latestResult?.prize }}</strong>
            </DrawResultDialog>

            <div class="rich-layout">
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


        </div>
    </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import MainLayout from '../common/main-layout.vue';
import MemberDrawAnimation, { MEMBER_DRAW_REQUEST_COUNT } from './member-draw-animation.vue';
import RouletteAnimation from './roulette-animation.vue';
import DrawResultDialog from './draw-result-dialog.vue';
import { usePrizesAndMembers } from '../../composables/usePrizesAndMembers';
import DrawAdapter from '../../../model/adapters/draw-adapter';
import { container } from 'tsyringe';

export default {
    name: 'DrawOrchestratorPage',
    components: { MainLayout, MemberDrawAnimation, RouletteAnimation, DrawResultDialog },
    setup() {
        const { prizes, members, objectUrlMap, fetchPrizes, fetchMembers } = usePrizesAndMembers();
        const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

        async function safeTry<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
            try {
                return await fn();
            } catch (e) {
                return fallback;
            }
        }
        const latestResult = ref<any | null>(null);
        const memberAnimRef = ref<any>(null);
        const rouletteRef = ref<any>(null);
        const selectedPrize = ref<any | null>(null);
        const showPrizeResult = ref(false);
        const isRunning = ref(false);
        const modalState = ref<null | 'half' | 'end' | 'memberWinner' | 'prizeWinner'>(null);
        const halfShown = ref(false);
        const totalPrizes = ref<number | null>(null);
        const currentPhase = ref<'member' | 'prize' | 'idle'>('member');
        const plannedPrizeRes = ref<any | null>(null);
        const plannedMemberRes = ref<any | null>(null);

        const memberAnimating = ref(false);
        const prizeAnimating = ref(false);

        const memberImageUrl = computed(() => {
            const id = latestResult.value?.memberId;
            if (!id) return null;
            const m = members.value.find((x: any) => x.id === id);
            if (!m) return null;
            if (m.photoAssetId) return objectUrlMap.get(m.photoAssetId) || null;
            return m.photoUrl || m.imageDataUrl || null;
        });

        const prizeImageUrl = computed(() => {
            const pid = latestResult.value?.prizeId;
            if (!pid) return null;
            const p = prizes.value.find((x: any) => x.id === pid);
            if (!p) return null;
            if (p.imageDataUrl) return p.imageDataUrl;
            if (p.imageAssetId) return objectUrlMap.get(p.imageAssetId) || null;
            return p.imageUrl || null;
        });

        onMounted(async () => {
            await fetchPrizes();
            await fetchMembers();

            const handler = (ev: KeyboardEvent) => {
                if (ev.key !== 'Enter') return;
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

        watch(currentPhase, async (now) => {
            if (now === 'member') {
                plannedMemberRes.value = await safeTry(() => DrawAdapter.executeMemberDraw({ requestCount: MEMBER_DRAW_REQUEST_COUNT }), null);
                try { if (memberAnimRef.value?.start) memberAnimRef.value.start(); } catch (e) { }
            }
        });

        const memberStart = async () => {
            if (!isRunning.value) await start();
            plannedPrizeRes.value = null;
            if (plannedMemberRes.value) {
                if (memberAnimRef.value?.start) memberAnimRef.value.start();
                return;
            }
            if (memberAnimRef.value?.startDraw) {
                try { await memberAnimRef.value.startDraw(); } catch (e) { /* ignore */ }
            } else if (memberAnimRef.value?.start) {
                memberAnimRef.value.start();
            }
        };

        const memberStop = async () => {
            let stopped: string | null = null;
            if (plannedMemberRes.value && memberAnimRef.value?.stopAt) {
                const targetId = plannedMemberRes.value?.winnerId || plannedMemberRes.value?.winner || null;
                try { stopped = await memberAnimRef.value.stopAt(targetId); } catch (e) { stopped = targetId; }
            } else if (memberAnimRef.value?.stopDraw) {
                try { stopped = await memberAnimRef.value.stopDraw(); } catch (e) { stopped = null; }
            } else if (memberAnimRef.value?.stopAt) {
                try { stopped = await memberAnimRef.value.stopAt(null); } catch (e) { stopped = null; }
            } else {
                stopped = null;
            }

            latestResult.value = { memberId: stopped, member: members.value.find((m: any) => m.id === stopped)?.name || stopped, prize: '', prizeId: null };
            plannedPrizeRes.value = await safeTry(() => DrawAdapter.executePrizeDraw({ memberId: stopped, requestCount: 8 }), null);
            plannedMemberRes.value = null;
            // wait 1 second (spec: 1秒停止後に当選DLGを表示)
            await delay(1000);
            modalState.value = 'memberWinner';
        };

        const prizeStart = async () => {
            if (!plannedPrizeRes.value) {
                // fallback: fetch now
                plannedPrizeRes.value = await safeTry(() => DrawAdapter.executePrizeDraw({ memberId: latestResult.value?.member || null, requestCount: 8 }), null);
            }
            const prizeRes = plannedPrizeRes.value;
            if (prizeRes && prizeRes.isKakuhen && rouletteRef.value?.runAutoReroll) {
                const dummy = prizeRes.dummyPrizeIds && prizeRes.dummyPrizeIds[0];
                const final = prizeRes.reservedPrizeIds && prizeRes.reservedPrizeIds[0];
                try {
                    const prizeId = await rouletteRef.value.runAutoReroll({ dummyPrizeId: dummy, finalPrizeId: final, bgm1Url: null, bgm2Url: null });
                    latestResult.value.prize = prizeId || final || null;
                    latestResult.value.prizeId = prizeId || final || null;
                    // wait 1 second before showing prize modal
                    await delay(1000);
                    modalState.value = 'prizeWinner';
                } catch (e) { /* ignore */ }
            } else {
                // normal: instruct roulette to spin toward selectedPrize when stopping
                selectedPrize.value = prizes.value.find((p: any) => p.id === (prizeRes?.winnerPrizeId || prizeRes?.prizeId)) || null;
                showPrizeResult.value = true;
                if (rouletteRef.value?.startSpin) rouletteRef.value.startSpin();
            }
        };

        const prizeStop = async () => {
            let prizeId: string | null = null;
            if (rouletteRef.value?.stopSpin) {
                const target = plannedPrizeRes.value?.winnerPrizeId || plannedPrizeRes.value?.prizeId || null;
                const idx = target ? prizes.value.findIndex((p: any) => p.id === target) : null;
                try { prizeId = await rouletteRef.value.stopSpin({ targetIndex: idx !== null && idx >= 0 ? idx : null, isFinal: true }); } catch (e) { prizeId = target; }
            } else {
                prizeId = plannedPrizeRes.value?.winnerPrizeId || plannedPrizeRes.value?.prizeId || null;
            }
            latestResult.value.prize = prizeId || plannedPrizeRes.value?.winnerPrizeId || null;
            latestResult.value.prizeId = prizeId || plannedPrizeRes.value?.winnerPrizeId || null;
            // wait 1 second then show prize modal; post-modal actions (remaining check and phase transition) are handled by watcher when modal closes
            await delay(1000);
            modalState.value = 'prizeWinner';
        };

        watch(modalState, async (now, prev) => {
            if (prev === 'memberWinner' && now === null) {
                currentPhase.value = 'prize';
                return;
            }
            if (prev === 'prizeWinner' && now === null) {
                try {
                    const svc = container.resolve<any>('DrawService');
                    const cnt = await safeTry(() => svc.getLastPrizeCount(), { remaining: 0, total: 0 });
                    if (cnt.remaining <= 0) {
                        modalState.value = 'end';
                    } else if (!halfShown.value && totalPrizes.value && cnt.remaining <= Math.floor(totalPrizes.value / 2)) {
                        modalState.value = 'half';
                        halfShown.value = true;
                    }
                } catch (e) { /* ignore */ }

                // after handling, go back to member phase
                currentPhase.value = 'member';
                // clear visual selection
                showPrizeResult.value = false;
                selectedPrize.value = null;
                plannedPrizeRes.value = null;
            }
        });

        return { prizes, members, latestResult, start, memberAnimRef, rouletteRef, selectedPrize, showPrizeResult, modalState, halfShown, currentPhase, memberStart, memberStop, prizeStart, prizeStop, plannedPrizeRes, memberImageUrl, prizeImageUrl };
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
