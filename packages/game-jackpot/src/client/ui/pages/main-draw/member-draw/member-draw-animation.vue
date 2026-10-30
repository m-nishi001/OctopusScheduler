<template>
    <div class="member-draw">
        <div class="viewport" ref="viewport">
            <div class="track" ref="track">
                <div v-for="(m, idx) in displayMembers" :key="m.id + '-' + idx"
                    :class="['member-item', { active: idx === (activeIndex ?? -999), left1: idx === ((activeIndex ?? -999) - 1), right1: idx === ((activeIndex ?? -999) + 1) }]">
                    <img :src="memberImageMap.get(m.photo) || defaultAvatar" alt="member" :style="{
                        transform: `scale(${scales[idx] ?? 1})`,
                        transition: isAnimating ? 'none' : 'transform 220ms ease, filter 220ms ease',
                        willChange: 'transform'
                    }" />
                </div>
            </div>
        </div>
        <div class="start-button-container" ref="startButtonContainer">
            <button class="start-button" :class="{ waiting: !isAnimating, animating: isAnimating }"
                :disabled="isAnimating" type="button" @click.prevent.stop="() => { }">{{ isAnimating ? 'STOP！' :
                    'START！'
                }} </button>
        </div>
        <MemberWinnerDialog :visible="showWinnerDialog" :title="winnerTitle" :image-url="winnerImageUrl"
            @shown="onWinnerDialogShown" @closed="onWinnerDialogClosed" />
    </div>
</template>

<script lang="ts">
import { pickStopTarget } from './stop-target';
import { buildReelLap, reelScale, repeatReel, startButtonCenterY } from './member-reel';
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import gsap from 'gsap';
import { container } from 'tsyringe';
import '../../../theme/jackpot-theme.css';
import type { MemberDto } from '@control/member/dto/member-dto';
import { MemberPhotoCache } from '@octopus/accounts';
import type { DrawMemberResponse } from '@control/draw/dto/draw-member-response';
import MemberWinnerDialog from './member-winner-dialog.vue';
import { useMemberDrawBgm } from './use-member-draw-bgm';
import { buildMemberStopSteps, pickMemberStopPattern, requiredLeadPx } from './member-stop-patterns';

// Public ref interface for parent components that call methods on this component
export type MemberAnimRef = {
    startDraw: (winnerId?: string | null) => void;
    start: (speed?: number) => void;
    stopAt: (id: string | null) => Promise<string | null>;
    stopDraw: () => Promise<string | null>;
};

export default {
    name: 'MemberDrawAnimation',
    components: { MemberWinnerDialog },
    props: {
        members: { type: Array as () => MemberDto[], default: () => [] },
        visibleCount: { type: Number, default: 10 },
        autoStart: { type: Boolean, default: false },
        // if true, the parent component is responsible for showing the winner dialog
        externalDialog: { type: Boolean, required: false, default: false },
        memberRes: { type: Object as () => DrawMemberResponse | null, default: null },
    },
    setup(props: any, { emit }: any) {
        const viewport = ref<HTMLDivElement | null>(null);
        const track = ref<HTMLDivElement | null>(null);
        const startButtonContainer = ref<HTMLDivElement | null>(null);
        const tweenRef: { tween: gsap.core.Tween | null } = { tween: null };
        const memberImageMap = container.resolve(MemberPhotoCache);
        // inline SVG placeholder (dark rounded avatar) as fallback so images render even when asset loading fails
        const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="%23111111"/><circle cx="60" cy="44" r="30" fill="%23888"/><rect x="20" y="86" width="80" height="12" rx="6" fill="%23888"/></svg>';

        // メンバー抽選中のBGM再生はアニメーション本体と独立した関心事のため
        // composableに分離している。
        const { playRandomMemberBgm, stopBgm } = useMemberDrawBgm();

        const displayMembers = ref<MemberDto[]>([]);

        const buildDisplay = () => {
            const allMembers: MemberDto[] = props.members.slice();
            const planned: DrawMemberResponse | null = props.memberRes;
            const winner = planned?.winnerId ? allMembers.find((m) => m.id === planned.winnerId) ?? null : null;
            const others = winner
                ? (planned!.dummyIds.map((id: string) => allMembers.find((m) => m.id === id)).filter(Boolean) as MemberDto[])
                : allMembers.slice(0, props.visibleCount);
            displayMembers.value = repeatReel(buildReelLap(others, winner, props.visibleCount, Math.random));
        };

        // Ensure the planned winner (if provided) is included in the visible display list.
        // Called from startDraw so stopAt can locate the planned winner among duplicated items.
        const ensureWinnerInDisplay = async (winnerId: string | null) => {
            const visible = Math.max(props.visibleCount ?? 1, 1);
            if (!winnerId) {
                buildDisplay();
                return;
            }

            const all: MemberDto[] = props.members.slice();
            const winner = all.find((m) => m.id === winnerId) ?? null;
            const others = winner ? all.filter((m) => m.id !== winnerId).slice(0, Math.max(visible - 1, 0)) : all.slice(0, visible);
            displayMembers.value = repeatReel(buildReelLap(others, winner, visible, Math.random, { unique: true }));

            try {
                await loadImages();
            } catch (e) {
                console.warn('[MemberDrawAnimation] ensureWinnerInDisplay: image preload failed', e);
            }
            await nextTick();
            try {
                updateActiveIndex();
                alignTrackToNearestChild(0);
                positionStartButton();
            } catch (e) {
                // ignore layout errors
            }
        };

        // 表示するメンバーの写真を読み込む。置き場は画面の外(共有)にあるので、抽選のたびに作り直されても読み直さず、
        // 次のサイクルの下ごしらえで先に読んであればここでは待たない。読み込みは並列。
        const loadImages = async () => {
            const base = displayMembers.value.slice(0, Math.max(displayMembers.value.length / 2, 0));
            await memberImageMap.ensure(base.map((m) => m?.photo));
        };

        const activeIndex = ref<number | null>(null);
        let rafId: number | null = null;
        const isAnimating = ref(false);

        const scales = ref<number[]>([]);

        const showWinnerDialog = ref(false);
        const winnerPhoto = ref('');
        const winnerName = ref('');
        const winnerTitle = computed(() => {
            const name = (winnerName.value || '').toString().trim();
            const display = name || '当選者';
            // explicit newline so the title does not wrap automatically; the CSS will use `white-space: pre`.
            return `${display} さん当選されました！\n前に出てきてください！`;
        });

        const winnerImageUrl = computed(() => {
            return memberImageMap.get(winnerPhoto.value) || defaultAvatar;
        });

        const updateActiveIndex = () => {
            if (!viewport.value || !track.value) return;
            const children = Array.from(track.value.children) as HTMLElement[];
            if (!children.length) return;
            const viewportRect = viewport.value.getBoundingClientRect();
            const viewportCenter = viewportRect.left + viewportRect.width / 2;
            let bestIdx = -1;
            let bestDist = Infinity;

            // prepare scales array
            if (scales.value.length !== children.length) scales.value = new Array(children.length).fill(1);

            const influence = viewportRect.width / 2; // この距離で拡大率が最小になる

            for (let i = 0; i < children.length; i++) {
                const c = children[i];
                const r = c.getBoundingClientRect();
                const center = r.left + r.width / 2;
                const dist = Math.abs(center - viewportCenter);

                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                }

                scales.value[i] = reelScale(dist, influence);
            }

            if (bestIdx >= 0 && activeIndex.value !== bestIdx) {
                activeIndex.value = bestIdx;
            }
        };

        const centerTrackOnIndex = (childIdx: number, duration = 0) => {
            if (!viewport.value || !track.value) return;
            const children = Array.from(track.value.children) as HTMLElement[];
            const item = children[childIdx];
            if (!item) return;
            const viewportRect = viewport.value.getBoundingClientRect();
            const viewportCenter = viewportRect.left + viewportRect.width / 2;
            const itemRect = item.getBoundingClientRect();
            const itemCenter = itemRect.left + itemRect.width / 2;
            const currentTransform = (gsap.getProperty(track.value, 'x') as number) || 0;
            const delta = viewportCenter - itemCenter;
            if (duration && duration > 0) {
                gsap.to(track.value, { x: currentTransform + delta, duration, ease: 'power3.out' });
            } else {
                gsap.set(track.value, { x: currentTransform + delta });
            }
        };

        const alignTrackToNearestChild = (duration = 0) => {
            if (!viewport.value || !track.value) return;
            const children = Array.from(track.value.children) as HTMLElement[];
            if (!children.length) return;
            const viewportRect = viewport.value.getBoundingClientRect();
            const viewportCenter = viewportRect.left + viewportRect.width / 2;
            let bestIdx = 0;
            let bestDist = Infinity;
            for (let i = 0; i < children.length; i++) {
                const r = children[i].getBoundingClientRect();
                const center = r.left + r.width / 2;
                const d = Math.abs(center - viewportCenter);
                if (d < bestDist) {
                    bestDist = d;
                    bestIdx = i;
                }
            }
            centerTrackOnIndex(bestIdx, duration);
            activeIndex.value = bestIdx;
        };

        const positionStartButton = () => {
            if (!startButtonContainer.value || !viewport.value || !track.value) return;
            const children = Array.from(track.value.children) as HTMLElement[];
            const viewportRect = viewport.value.getBoundingClientRect();
            let centerY = viewportRect.top + viewportRect.height / 2;
            if (activeIndex.value != null && children[activeIndex.value]) {
                const r = children[activeIndex.value].getBoundingClientRect();
                centerY = r.top + r.height / 2;
            }
            const btn = startButtonContainer.value;
            // 画面に固定して、いつも窓に対する位置にする(横の中央寄せは CSS)
            btn.style.position = 'fixed';
            btn.style.top = `${startButtonCenterY(centerY, window.innerHeight, btn.offsetHeight || 0)}px`;
            btn.style.transform = 'translateY(-50%)';
        };

        const startActiveLoop = () => {
            if (rafId != null) return;
            const loop = () => {
                updateActiveIndex();
                // only reposition the start button when NOT animating so the button doesn't move during spin
                try {
                    if (!isAnimating.value) positionStartButton();
                } catch (e) { }
                rafId = requestAnimationFrame(loop);
            };
            rafId = requestAnimationFrame(loop);
        };

        const stopActiveLoop = () => {
            if (rafId != null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };

        let plannedWinnerId: string | null = null;

        const start = (speed = 2400) => {
            if (!track.value || !viewport.value) return;
            gsap.killTweensOf(track.value);
            const trackWidth = track.value.scrollWidth / 10;
            tweenRef.tween = gsap.to({}, {
                duration: 100000, ease: 'none', onUpdate: () => {
                    gsap.set(track.value, { x: `-=${speed / 60}` });
                    const currentX = gsap.getProperty(track.value, 'x') as number;
                    if (currentX <= -9 * trackWidth) {
                        gsap.set(track.value, { x: currentX + 9 * trackWidth });
                    }
                }
            });
            isAnimating.value = true;
            startActiveLoop();
        };

        /**
         * 指定した参加者の位置(中央に近いコピー)へ止める。止めた参加者の id を返す。
         * 指定した参加者が表示の中に無いときは、別の人で止めず、例外にする(画面の当選と保存した抽選結果が食い違うため)。
         * 参加者を指定しない(null)ときだけ、中央にいちばん近い人で止める。
         */
        const stopAt = (memberId: string | null): Promise<string | null> => {
            return new Promise((resolve, reject) => {
                if (!track.value || !viewport.value) {
                    resolve(null);
                    return;
                }
                gsap.killTweensOf(track.value);
                // stop continuous tween
                if (tweenRef.tween) tweenRef.tween.kill();

                const children = Array.from(track.value.children) as HTMLElement[];
                if (!children.length) {
                    resolve(null);
                    return;
                }

                const viewportRect = viewport.value.getBoundingClientRect();
                const viewportCenter = viewportRect.left + viewportRect.width / 2;

                const childCenterDist = (i: number) => {
                    const r = children[i].getBoundingClientRect();
                    const center = r.left + r.width / 2;
                    return Math.abs(center - viewportCenter);
                };

                let targetChildIdx: number;
                try {
                    targetChildIdx = pickStopTarget(
                        children.map((_, i) => displayMembers.value[i]?.id ?? null),
                        memberId,
                        childCenterDist
                    );
                } catch (error) {
                    reject(error);
                    return;
                }

                // 止まり方を選ぶ。手前から進入する止まり方は、当選者の位置が中央より十分右にあるときだけ(無ければふつうに止まる)
                const centerOf = (i: number) => {
                    const r = children[i].getBoundingClientRect();
                    return r.left + r.width / 2;
                };
                const pitch = children.length > 1
                    ? Math.abs(children[1].getBoundingClientRect().left - children[0].getBoundingClientRect().left) || children[0].getBoundingClientRect().width
                    : children[0].getBoundingClientRect().width;
                let stopPattern = pickMemberStopPattern();
                const lead = requiredLeadPx(stopPattern, pitch);
                if (lead > 0 && targetChildIdx >= 0) {
                    const winnerId = displayMembers.value[targetChildIdx]?.id ?? null;
                    const ahead: number[] = [];
                    for (let i = 0; i < children.length; i++) {
                        if ((displayMembers.value[i]?.id ?? null) === winnerId && centerOf(i) - viewportCenter >= lead) ahead.push(i);
                    }
                    if (ahead.length) {
                        targetChildIdx = ahead.reduce((best, cur) => (centerOf(cur) < centerOf(best) ? cur : best), ahead[0]);
                    } else {
                        stopPattern = 'smooth';
                    }
                }

                const item = children[targetChildIdx];
                if (!item) {
                    resolve(null);
                    return;
                }

                const itemRect = item.getBoundingClientRect();
                const currentTransform = (gsap.getProperty(track.value, 'x') as number) || 0;
                const itemCenter = itemRect.left + itemRect.width / 2;
                const delta = viewportCenter - itemCenter;
                const finalX = currentTransform + delta;

                const steps = buildMemberStopSteps(stopPattern, finalX, pitch);
                // e2e(jackpot-stop-patterns)が、選ばれた止まり方をこのログから読む。文言を変えるときはテストも直す。
                console.log('[MemberDrawAnimation] stopAt: pattern', stopPattern);
                const tl = gsap.timeline({
                    onComplete: () => {
                        const id = displayMembers.value[targetChildIdx]?.id ?? null;
                        activeIndex.value = targetChildIdx;
                        emit('stopped', id);
                        stopActiveLoop();
                        try { isAnimating.value = false; } catch (e) { }
                        try { positionStartButton(); } catch (e) { }
                        // Set winner info and show dialog
                        const winner = displayMembers.value[targetChildIdx];
                        if (winner) {
                            winnerPhoto.value = winner.photo || '';
                            winnerName.value = winner.name;
                            // only show the internal dialog when the parent is NOT handling the dialog
                            try {
                                if (!props.externalDialog) showWinnerDialog.value = true;
                            } catch (e) {
                                // defensive: if props aren't available for any reason, default to showing
                                showWinnerDialog.value = true;
                            }
                        }
                        resolve(id);
                    }
                });
                for (const step of steps) {
                    tl.to(track.value, { x: step.x, duration: step.duration, ease: step.ease }, step.delay ? `+=${step.delay}` : undefined);
                }
            });
        };

        // High-level: start the draw by requesting a planned winner then animating
        // Start the animation with an externally-provided planned winner id.
        // The actual draw logic (remote call / winner selection) must be done
        // by an external orchestrator (e.g. draw-orchestrator-view.vue). This
        // component only receives the planned id and performs the animation.
        // 開始の準備(当選者を表示に入れる)が終わるまでを表す。stopDraw はこれを待ってから止める
        // (開始の準備中に止めると、止めたあとにリールが回り出し、二度と止まらなかった)。
        let starting: Promise<void> = Promise.resolve();

        const startDraw = (winnerId?: string | null) => {
            plannedWinnerId = winnerId ?? null;
            // Ensure winner is part of the displayed set before starting animation
            starting = (async () => {
                try {
                    await ensureWinnerInDisplay(plannedWinnerId);
                } catch (e) {
                    console.warn('[MemberDrawAnimation] startDraw: ensureWinnerInDisplay failed', e);
                }
                start();
                void playRandomMemberBgm();
            })();
            return plannedWinnerId;
        };

        const stopDraw = async (): Promise<string | null> => {
            await starting;
            let id: string | null;
            try {
                id = await stopAt(plannedWinnerId || null);
            } finally {
                try { await stopBgm(); } catch (e) { /* ignore */ }
                plannedWinnerId = null;
            }
            emit('member-selected', id);
            return id;
        };

        // runAutoReroll removed — orchestrator should use start/stop APIs instead

        onMounted(async () => {
            buildDisplay();
            await loadImages();
            updateActiveIndex();
            alignTrackToNearestChild(0);
            positionStartButton();
            window.addEventListener('resize', positionStartButton);
            startActiveLoop();
            if (props.autoStart) start();
        });

        onUnmounted(() => {
            isAnimating.value = false;
            if (tweenRef.tween) tweenRef.tween.kill();
            gsap.killTweensOf(track.value);
            stopActiveLoop();
            window.removeEventListener('resize', positionStartButton);
        });

        watch(() => [props.members, props.visibleCount], async () => {
            buildDisplay();
            await loadImages();
            updateActiveIndex();
            alignTrackToNearestChild(0);
            positionStartButton();
        }, { deep: true });

        watch(activeIndex, () => {
            if (!isAnimating.value) positionStartButton();
        });

        // フォーカス管理・overflow制御はMemberWinnerDialog側に移した。ここでは
        // 外部向けの既存イベント契約(winner-dialog-shown/closed)だけを維持する。
        const onWinnerDialogShown = () => {
            try { emit('winner-dialog-shown'); } catch (e) { /* ignore */ }
        };
        const onWinnerDialogClosed = () => {
            try { emit('winner-dialog-closed'); } catch (e) { /* ignore */ }
        };

        const handleStart = () => {
            emit('start');
        };

        return { viewport, track, startButtonContainer, displayMembers, memberImageMap, defaultAvatar, start, stopAt, activeIndex, startDraw, stopDraw, handleStart, scales, isAnimating, showWinnerDialog, winnerPhoto, winnerName, winnerTitle, winnerImageUrl, onWinnerDialogShown, onWinnerDialogClosed };
    }
};
</script>

<style scoped>
.member-draw {
    width: 100%;
    position: relative;
    padding: 0;
    box-sizing: border-box;
}

.viewport {
    width: 100%;
    overflow: hidden;
    height: 560px;
    /* give vertical space for large centered item */
    display: flex;
    align-items: center;
}

.track {
    display: flex;
    align-items: center;
    justify-content: center;
    /* center the duplicated track so the visible items are centered */
    gap: 36px;
    /* spacing between items */
}

.member-item {
    width: 240px;
    flex: 0 0 240px;
    text-align: center;
    padding: 8px;
    box-sizing: border-box;
    transition: transform 220ms ease, opacity 200ms ease;
    opacity: 0.9;
}

.member-item img {
    width: 192px;
    height: 192px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    margin: 0 auto 6px auto;
    transition: transform 220ms ease, filter 220ms ease;
}

/* Names are intentionally hidden in this layout */
.member-item .name {
    display: none;
}

/* Active center styling: larger center, medium neighbors */
.member-item.active img {
    transform: scale(1.8);
    border-radius: 50%;
    box-shadow: 0 0 0 4px var(--jp-gold), 0 0 28px rgba(255, 213, 74, 0.8);
}

.member-item.left1 img,
.member-item.right1 img {
    transform: scale(1.08);
}

.member-item:not(.active):not(.left1):not(.right1) img {
    transform: scale(0.8);
    filter: saturate(0.6) brightness(0.9);
}

.member-item.active {
    opacity: 1;
}

.member-item.left1,
.member-item.right1 {
    opacity: 0.95;
}

.start-button-container {
    /* Full-width fixed container; horizontally center children with flex.
       JS will update `top` to position vertically. Container itself is non-interactive so clicks fall through
       to the button which is interactive. */
    position: fixed;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
    width: 100%;
    box-sizing: border-box;
}

.start-button-container .start-button {
    /* allow the button itself to be interactive despite the container being inert */
    pointer-events: auto;
    display: inline-block;
}

.start-button {
    background: linear-gradient(180deg, var(--jp-gold-light), var(--jp-gold) 55%, var(--jp-gold-deep));
    color: var(--jp-ink);
    padding: 28px 56px;
    border-radius: 999px;
    border: 3px solid var(--jp-gold-light);
    font-weight: 900;
    font-size: clamp(28px, 4.5vw, 48px);
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    max-width: 90vw;
    box-sizing: border-box;
}

.start-button:disabled {
    cursor: not-allowed;
    opacity: 1;
}

@keyframes waiting {

    0%,
    100% {
        transform: scale(1);
        opacity: 1;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }

    50% {
        transform: scale(1.05);
        opacity: 0.9;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 10px rgba(255, 255, 255, 0.3);
    }
}

@keyframes animating {
    0% {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 20px rgba(255, 255, 255, 0.5);
    }

    50% {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 40px rgba(255, 213, 74, 1), 0 0 60px rgba(200, 16, 46, 0.6);
    }

    100% {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 20px rgba(255, 255, 255, 0.5);
    }
}

.start-button.waiting {
    animation: waiting 1s ease-in-out infinite;
}

.start-button.animating {
    animation: animating 0.5s ease-in-out infinite;
}
</style>
