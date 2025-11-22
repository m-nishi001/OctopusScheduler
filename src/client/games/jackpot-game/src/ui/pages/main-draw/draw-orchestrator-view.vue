<template>
    <MainLayout>
        <div class="orchestrator container mx-auto p-6">

            <DrawResultDialog v-if="showPrizeWinningDialog" title="景品当選" :assetId="latestResult?.wonPrize?.imageAssetId"
                primaryLabel="次へ">
            </DrawResultDialog>

            <HalfRemainingDialog v-if="showHalfRemainingDialog" :visible="showHalfRemainingDialog" />
            <EndDialog v-if="showEndDialog" :visible="showEndDialog" />

            <div class="rich-layout">
                <section class="member-area-fullscreen" v-if="drawState.phase === 'member'">
                    <div class="member-stage-fullscreen">
                        <MemberDrawAnimation ref="memberAnimRef" :members="members" :externalDialog="false" />
                    </div>
                </section>

                <section v-if="drawState.phase === 'prize'"
                    class="center-area flex items-center justify-center min-h-screen">
                    <div class="roulette-panel">
                        <component :is="currentPrizeComponent" ref="animationRef" :prizes="prizes"
                            :selectedPrize="selectedPrize" :showResult="showPrizeWinningDialog" />
                    </div>
                </section>
            </div>

        </div>
        <teleport to="body">
            <KakuhenOverlay :visible="kakuhenOverlayVisible" />
        </teleport>
    </MainLayout>
</template>

<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import MemberDrawAnimation from './member-draw/member-draw-animation.vue';
import DrawResultDialog from './prize-winning-dialog.vue';
import HalfRemainingDialog from './half-remaining-dialog.vue';
import EndDialog from './end-dialog.vue';
import SlotAnimation from './slot/slot-animation.vue';
import RouletteAnimation from './roulette/roulette-animation.vue';
import { useDrawOrchestrator } from './use-draw-orchestrator';
import KakuhenOverlay from '../../components/KakuhenOverlay.vue';

export default {
    name: 'DrawOrchestratorPage',
    components: { MainLayout, MemberDrawAnimation, RouletteAnimation, SlotAnimation, DrawResultDialog, HalfRemainingDialog, EndDialog, KakuhenOverlay },
    setup() {
        // use composable that contains the orchestration logic
        const s = useDrawOrchestrator();
        // spread returned properties so the template type-checker sees them
        return { ...s } as any;
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
.rich-layout .member-area-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #0b0b0b;
    z-index: 50;
}

.member-stage-fullscreen {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
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

.kakuhen-overlay {
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    font-size: 64px;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.6);
    padding: 20px 40px;
    border-radius: 12px;
    border: 3px solid #ff6b6b;
    box-shadow: 0 0 30px rgba(255, 107, 107, 0.6);
}

.kakuhen-overlay-global {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 20000;
    /* above dialog which uses 10000 */
    font-size: 64px;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.6);
    padding: 20px 40px;
    border-radius: 12px;
    border: 3px solid #ff6b6b;
    box-shadow: 0 0 30px rgba(255, 107, 107, 0.6);
}
</style>
