<template>
    <MainLayout>
        <div class="orchestrator container mx-auto p-6">
            <div class="header flex items-start justify-between mb-6">
                <div>
                    <h2 class="text-2xl font-bold">ジャックポッド抽選（本抽選）</h2>
                    <p class="mt-1 text-sm text-gray-600">Enterで操作（開始 / 停止 / 続行）</p>
                </div>
                <div class="controls">
                    <button @click="memberStart" :disabled="!dataLoaded" class="btn-primary"
                        :aria-disabled="!dataLoaded">
                        <span v-if="!dataLoaded">読み込み中...</span>
                        <span v-else>開始</span>
                    </button>
                </div>
            </div>

            <DrawResultDialog v-if="modalState === 'half'" title="残り半分です！"
                :message="'残りの景品が半分になりました。続行するには Enter を押してください。'" @close="modalState = null" />

            <DrawResultDialog v-if="modalState === 'end'" title="抽選は終了しました"
                :message="'全ての景品が配布されました。Enter を押すと結果画面へ移動します。'" @close="modalState = null" />

            <DrawResultDialog v-if="modalState === 'prizeWinner'" title="景品当選" :imageUrl="prizeImageUrl"
                primaryLabel="Enter で続行" @close="modalState = null">
                当選景品: <strong>{{ latestResult?.prize?.name }}</strong>
            </DrawResultDialog>

            <div class="rich-layout">
                <section class="member-area mb-6" v-if="currentPhase === 'member'">
                    <div class="member-stage mx-auto">
                        <div class="stage-frame">
                            <MemberDrawAnimation ref="memberAnimRef" :members="members" />
                        </div>

                        <div class="start-box" role="button" tabindex="0"
                            :class="{ 'opacity-50 cursor-not-allowed': !dataLoaded }"
                            @click="dataLoaded && memberStart()" :aria-disabled="!dataLoaded">
                            <div class="start-label">START!!</div>
                        </div>
                    </div>
                </section>

                <section v-if="currentPhase === 'prize'"
                    class="center-area grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div class="result-panel col-span-1 md:col-span-1 bg-white/80 rounded p-4 shadow">
                        <h4 class="font-semibold mb-2">直近の当選</h4>
                        <div v-if="latestResult">
                            <p class="text-sm">メンバー: <strong>{{ latestResult.member.name }}</strong></p>
                            <p class="text-sm">景品: <strong>{{ latestResult.prize?.name || '（未決定）' }}</strong></p>
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
import { ref, reactive, toRefs, onMounted, onUnmounted, watch, computed } from 'vue';
import MainLayout from '../common/main-layout.vue';
import MemberDrawAnimation, { MEMBER_DRAW_REQUEST_COUNT, type MemberAnimRef } from './member-draw-animation.vue';
import RouletteAnimation, { type RouletteRef } from './roulette-animation.vue';
import DrawResultDialog from './draw-result-dialog.vue';
import { DrawService } from '../../../model/applications/draw/draw-service';
import { PrizeRepository } from '../../../model/infrastructures/prize-repository';
import { MemberRepository } from '../../../model/infrastructures/member-repository';
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';
import type { PrizeDto } from '../../../model/applications/prize/dto/prize-dto';
import type { MemberDto } from '../../../model/applications/member/dto/member-dto';
import type { DrawMemberResponse } from '../../../model/applications/draw/dto/draw-member-response';
import type { DrawPrizeResponse } from '../../../model/applications/draw/dto/draw-prize-response';
import type { DrawResultDto } from '../../../model/applications/draw-result/dto/draw-result-dto';
import type { Asset } from '../../../model/domains/drive-data/asset-data';
import { container } from 'tsyringe';

export default {
    name: 'DrawOrchestratorPage',
    components: { MainLayout, MemberDrawAnimation, RouletteAnimation, DrawResultDialog },
    setup(_, { emit }) {
        const state = reactive({
            prizes: [] as PrizeDto[],
            members: [] as MemberDto[],
            dataLoaded: false,
            latestResult: null as DrawResultDto | null,
            selectedPrize: null as PrizeDto | null,
            showPrizeResult: false,
            modalState: null as null | 'half' | 'end' | 'memberWinner' | 'prizeWinner',
            halfShown: false,
            totalPrizes: null as number | null,
            currentPhase: 'member' as 'member' | 'prize' | 'idle',
            plannedPrizeRes: null as DrawPrizeResponse | null,
            plannedMemberRes: null as DrawMemberResponse | null,
        });

        const tempMemberUrl = ref<string | null>(null);
        const tempPrizeUrl = ref<string | null>(null);

        const prizeRepo = container.resolve(PrizeRepository);
        const memberRepo = container.resolve(MemberRepository);
        const assetService = container.resolve(AssetDataService);
        const drawService = container.resolve(DrawService) as DrawService;

        const fetchObjectUrlOnce = async (assetId: string | null): Promise<string | null> => {
            if (!assetService || !assetId) return null;
            try {
                const asset = await safeTry<Asset | null>(() => assetService.getAssetDataById(assetId), null);
                if (asset && asset.blob) {
                    return URL.createObjectURL(asset.blob);
                }
            } catch (e) {
                // ignore asset fetch errors
            }
            return null;
        };

        const cleanup = () => {
            if (tempMemberUrl.value) URL.revokeObjectURL(tempMemberUrl.value);
            if (tempPrizeUrl.value) URL.revokeObjectURL(tempPrizeUrl.value);
            tempMemberUrl.value = null;
            tempPrizeUrl.value = null;
        };

        onUnmounted(cleanup);

        const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

        async function safeTry<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
            try {
                return await fn();
            } catch (e) {
                return fallback;
            }
        }
        const memberAnimRef = ref<MemberAnimRef | null>(null);
        const rouletteRef = ref<RouletteRef | null>(null);
        const currentEnterAction = ref<(() => void) | null>(null);

        const memberImageUrl = computed<string | undefined>(() => {
            const id = state.latestResult?.member?.id;
            if (!id) return undefined;
            const m = state.members.find((x: MemberDto) => x.id === id);
            if (!m) return undefined;
            if (m.photoAssetId) return tempMemberUrl.value ?? undefined;
            return undefined;
        });

        const prizeImageUrl = computed<string | undefined>(() => {
            const pid = state.latestResult?.prize?.id;
            if (!pid) return undefined;
            const p = state.prizes.find((x: PrizeDto) => x.id === pid);
            if (!p) return undefined;
            if (p.imageAssetId) return tempPrizeUrl.value ?? undefined;
            return undefined;
        });

        onMounted(async () => {
            const [prizes, members] = await Promise.all([prizeRepo.getPrizes(), memberRepo.getMembers()]);
            state.prizes = prizes;
            state.members = members;

            state.dataLoaded = true;

            const keydownDelegator = (ev: KeyboardEvent) => {
                if (ev.key !== 'Enter') return;
                const fn = currentEnterAction.value;
                if (!fn) return;
                try { fn(); } catch (e) { /* ignore handler errors */ }
            };

            window.addEventListener('keydown', keydownDelegator);
            onUnmounted(() => window.removeEventListener('keydown', keydownDelegator));

            currentEnterAction.value = () => { void memberStart(); };
        });

        const prepareMemberPhase = async () => {
            try {
                state.plannedMemberRes = await drawService.executeMemberDraw({ requestCount: MEMBER_DRAW_REQUEST_COUNT });
            } catch (e) {
                state.plannedMemberRes = null;
            }

            try {
                const memberId = state.plannedMemberRes?.winnerId ?? '';
                if (memberId) {
                    state.plannedPrizeRes = await drawService.executePrizeDraw({ memberId, requestCount: 8 });
                } else {
                    state.plannedPrizeRes = null;
                }
            } catch (e) {
                state.plannedPrizeRes = null;
            }
        };

        const memberStart = async () => {
            if (!state.dataLoaded) {
                console.warn('[DrawOrchestrator] memberStart() called before initial data was loaded. Ignoring.');
                return;
            }
            state.plannedPrizeRes = null;

            currentEnterAction.value = () => { void memberStop(); };

            if (!state.plannedMemberRes) {
                try {
                    state.plannedMemberRes = await drawService.executeMemberDraw({ requestCount: MEMBER_DRAW_REQUEST_COUNT });
                } catch (e) {
                    state.plannedMemberRes = null;
                }
            }

            const winnerId = state.plannedMemberRes?.winnerId ?? null;
            if (memberAnimRef.value?.startDraw) {
                try { memberAnimRef.value.startDraw(winnerId); } catch (e) { /* ignore */ }
            } else if (memberAnimRef.value?.start) {
                memberAnimRef.value.start();
            }
        };

        const memberStop = async () => {
            let stopped: string | null = null;
            if (state.plannedMemberRes && memberAnimRef.value?.stopAt) {
                const targetId = state.plannedMemberRes?.winnerId ?? null;
                try { stopped = await memberAnimRef.value.stopAt(targetId); } catch (e) { stopped = targetId; }
            } else if (memberAnimRef.value?.stopDraw) {
                try { stopped = await memberAnimRef.value.stopDraw(); } catch (e) { stopped = null; }
            } else if (memberAnimRef.value?.stopAt) {
                try { stopped = await memberAnimRef.value.stopAt(null); } catch (e) { stopped = null; }
            } else {
                stopped = null;
            }

            const memberObj = state.members.find((m: MemberDto) => m.id === stopped) || { id: stopped || '', name: String(stopped || ''), photoAssetId: undefined, rank: 0 } as MemberDto;
            state.latestResult = {
                drawId: state.plannedMemberRes?.drawId || 'member-' + Date.now(),
                member: memberObj,
                prize: null,
                rank: null,
                order: 1,
                isWinner: true,
            };

            try {
                state.plannedPrizeRes = await drawService.executePrizeDraw({ memberId: state.latestResult.member.id || '', requestCount: 8 });
            } catch (e) {
                state.plannedPrizeRes = null;
            }

            state.plannedMemberRes = null;
            await delay(1000);
            const aid = state.latestResult?.member?.photoAssetId || null;
            if (aid) {
                if (tempMemberUrl.value) URL.revokeObjectURL(tempMemberUrl.value);
                tempMemberUrl.value = null;
                const url = await fetchObjectUrlOnce(aid);
                if (url) tempMemberUrl.value = url;
            }

            emit('member-winner', { result: state.latestResult, memberImageUrl: tempMemberUrl.value });
            currentEnterAction.value = null;
        };

        const prizeStart = async () => {
            currentEnterAction.value = () => { void prizeStop(); };
            if (!state.plannedPrizeRes) {
                try {
                    state.plannedPrizeRes = await drawService.executePrizeDraw({ memberId: state.latestResult?.member?.id || '', requestCount: 8 });
                } catch (e) {
                    state.plannedPrizeRes = null;
                }
            }
            const prizeRes = state.plannedPrizeRes;
            if (prizeRes && prizeRes.isKakuhen && rouletteRef.value?.runAutoReroll) {
                const dummy = prizeRes.dummyPrizeIds && prizeRes.dummyPrizeIds[0];
                const final = prizeRes.reservedPrizeIds && prizeRes.reservedPrizeIds[0];
                try {
                    const prizeId = await rouletteRef.value.runAutoReroll({ dummyPrizeId: dummy, finalPrizeId: final, bgm1Url: null, bgm2Url: null });
                    if (!state.latestResult) {
                        const fallbackMember = state.members.find((m) => m.id === state.plannedMemberRes?.winnerId) || state.members[0] || ({ id: '', name: '', photoAssetId: undefined, rank: 0 } as MemberDto);
                        state.latestResult = {
                            drawId: state.plannedMemberRes?.drawId || 'prize-' + Date.now(),
                            member: fallbackMember,
                            prize: null,
                            rank: null,
                            order: 1,
                            isWinner: true,
                        };
                    }
                    const prizeObj = state.prizes.find((p) => p.id === (prizeId || final || '')) || null;
                    state.latestResult.prize = prizeObj;
                    await delay(1000);
                    state.modalState = 'prizeWinner';
                } catch (e) { /* ignore */ }
            } else {
                state.selectedPrize = state.prizes.find((p: PrizeDto) => p.id === prizeRes?.winnerPrizeId) || null;
                state.showPrizeResult = true;
                if (rouletteRef.value?.startSpin) rouletteRef.value.startSpin();
            }
        };

        const prizeStop = async () => {
            let prizeId: string | null = null;
            if (rouletteRef.value?.stopSpin) {
                const target = state.plannedPrizeRes?.winnerPrizeId ?? null;
                const idx = target ? state.prizes.findIndex((p: PrizeDto) => p.id === target) : null;
                try { prizeId = await rouletteRef.value.stopSpin({ targetIndex: idx !== null && idx >= 0 ? idx : null, isFinal: true }); } catch (e) { prizeId = target; }
            } else {
                prizeId = state.plannedPrizeRes?.winnerPrizeId ?? null;
            }
            if (!state.latestResult) {
                const fallbackMember = state.members.find((m) => m.id === state.plannedMemberRes?.winnerId) || state.members[0] || ({ id: '', name: '', photoAssetId: undefined, rank: 0 } as MemberDto);
                state.latestResult = {
                    drawId: state.plannedMemberRes?.drawId || 'prize-' + Date.now(),
                    member: fallbackMember,
                    prize: null,
                    rank: null,
                    order: 1,
                    isWinner: true,
                };
            }
            const prizeObj2 = state.prizes.find((p) => p.id === (prizeId || state.plannedPrizeRes?.winnerPrizeId || '')) || null;
            state.latestResult.prize = prizeObj2;
            await delay(1000);
            state.modalState = 'prizeWinner';
            currentEnterAction.value = null;
        };

        watch(() => state.modalState, async (now, prev) => {
            if (now === 'prizeWinner') {
                const pid = state.latestResult?.prize?.id;
                const p = state.prizes.find((x: PrizeDto) => x.id === pid);
                const aid = p?.imageAssetId || null;
                if (aid) {
                    if (tempPrizeUrl.value) URL.revokeObjectURL(tempPrizeUrl.value);
                    tempPrizeUrl.value = null;
                    void fetchObjectUrlOnce(aid).then((url) => { if (url) tempPrizeUrl.value = url; });
                }
            }

            if (prev === 'prizeWinner' && now === null) {
                if (tempPrizeUrl.value) URL.revokeObjectURL(tempPrizeUrl.value);
                tempPrizeUrl.value = null;
                try {
                    const cnt = await safeTry(() => drawService.getLastPrizeCount(), { remaining: 0, total: 0 });
                    if (state.totalPrizes == null) state.totalPrizes = typeof cnt.total === 'number' ? cnt.total : state.totalPrizes;
                    if ((cnt.remaining ?? 0) <= 0) {
                        state.modalState = 'end';
                    } else if (!state.halfShown && state.totalPrizes != null && (cnt.remaining ?? 0) <= Math.floor(state.totalPrizes / 2)) {
                        state.modalState = 'half';
                        state.halfShown = true;
                    }
                } catch (e) { /* ignore */ }

                try { await prepareMemberPhase(); } catch (e) { /* ignore */ }
                state.currentPhase = 'member';
                currentEnterAction.value = () => { void memberStart(); };
                state.showPrizeResult = false;
                state.selectedPrize = null;
                state.plannedPrizeRes = null;
            }
        });

        const continueAfterMemberModal = async () => {
            if (tempMemberUrl.value) URL.revokeObjectURL(tempMemberUrl.value);
            tempMemberUrl.value = null;
            state.currentPhase = 'prize';
            currentEnterAction.value = () => { void prizeStart(); };
        };

        return { ...toRefs(state), memberAnimRef, rouletteRef, memberStart, memberStop, prizeStart, prizeStop, memberImageUrl, prizeImageUrl, continueAfterMemberModal };
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
