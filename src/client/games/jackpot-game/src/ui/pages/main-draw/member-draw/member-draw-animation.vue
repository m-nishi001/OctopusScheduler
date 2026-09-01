<template>
    <div class="member-draw">
        <div class="viewport" ref="viewport">
            <div class="track" ref="track">
                <div v-for="(m, idx) in displayMembers" :key="m.id + '-' + idx"
                    :class="['member-item', { active: idx === (activeIndex ?? -999), left1: idx === ((activeIndex ?? -999) - 1), right1: idx === ((activeIndex ?? -999) + 1) }]">
                    <img :src="memberImageMap.get(m.photoAssetId || '') || defaultAvatar" alt="member" :style="{
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
        <!-- Inline member winner dialog (defined here for readability/maintenance per request) -->
        <teleport to="body">
            <div v-if="showWinnerDialog" class="dialog-overlay" role="dialog" aria-modal="true">
                <div class="dialog-content">
                    <h3 class="dialog-title">{{ winnerTitle }}</h3>
                    <div v-if="winnerImageUrl" class="dialog-image-wrap">
                        <img :src="winnerImageUrl" alt="winner" class="modal-image" />
                    </div>
                    <div class="dialog-actions">
                        <!-- Inert: clicking does not close; parent orchestrator will handle flow via Enter/currentAction -->
                        <button ref="nextBtn" type="button" class="btn-primary"
                            @click.prevent.stop="() => { }">次へ</button>
                    </div>
                </div>
            </div>
        </teleport>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import gsap from 'gsap';
import type { MemberDto } from '@model/applications/member/dto/member-dto';
import { container } from 'tsyringe';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { ScreenSettingsService } from '@model/applications/screen-config/screen-settings-service';
import { useAudio } from '@shared-composables/use-audio';
import type { DrawMemberResponse } from '@model/applications/draw/dto/draw-member-response';
// draw-result-dialog.vue was previously used for the modal. For readability
// we define the member-specific winner dialog inline in this component.

// Per-animation defaults (hardcoded here per your request)
export const MEMBER_DRAW_REQUEST_COUNT = 10;
export const MEMBER_DUMMY_DISPLAY_COUNT = 0;

// Public ref interface for parent components that call methods on this component
export type MemberAnimRef = {
    startDraw: (winnerId?: string | null) => void;
    start: (speed?: number) => void;
    stopAt: (id: string | null) => Promise<string | null>;
    stopDraw: () => Promise<string | null>;
};

export default {
    name: 'MemberDrawAnimation',
    components: {},
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
        const nextBtn = ref<HTMLButtonElement | null>(null);
        const tweenRef: { tween: gsap.core.Tween | null } = { tween: null };
        const memberImageMap = new Map<string, string>();
        // inline SVG placeholder (dark rounded avatar) as fallback so images render even when asset loading fails
        const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="%23111111"/><circle cx="60" cy="44" r="30" fill="%23888"/><rect x="20" y="86" width="80" height="12" rx="6" fill="%23888"/></svg>';

        const assetService = container.resolve(AssetDataService);
        const screenSettingsService = container.resolve(ScreenSettingsService);

        // Generic audio composable — this component is responsible for member BGM playback
        const { load, play, stop, setVolume } = useAudio({
            assetService,
            screenSettingsService,
        });

        const loadGlobalVolume = async () => {
            try {
                const cfg = await screenSettingsService.fetchScreenSetting('main', 'global-volume');
                if (cfg && typeof cfg.volume === 'number') setVolume(cfg.volume);
            } catch (e) {
                console.error('Failed to load global volume:', e);
            }
        };

        const playRandomMemberBgm = async () => {
            try {
                await loadGlobalVolume();
                const cfg = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
                if (!cfg || !cfg.memberLotteryBgms || cfg.memberLotteryBgms.length === 0) return;
                const bgmIds: string[] = cfg.memberLotteryBgms.filter((id: string) => id && id.trim());
                if (bgmIds.length === 0) return;
                const randomId = bgmIds[Math.floor(Math.random() * bgmIds.length)];
                const asset = await assetService.getAssetDataById(randomId);
                if (asset && asset.blob) {
                    await stop();
                    await load(asset.blob);
                    await play({ isRepeat: true });
                }
            } catch (e) {
                console.error('Failed to play member BGM:', e);
            }
        };

        const displayMembers = ref<MemberDto[]>([]);

        const buildDisplay = () => {
            console.log('★ [MemberDrawAnimation] buildDisplay called with memberRes:', props.memberRes);
            const allMembers = props.members.slice();
            let list: MemberDto[] = [];

            if (props.memberRes && props.memberRes.winnerId) {
                const winner = allMembers.find((m: MemberDto) => m.id === props.memberRes!.winnerId);
                if (winner) {
                    // ダミーIDを先に配置
                    const dummies = props.memberRes.dummyIds.map((id: string) => allMembers.find((m: MemberDto) => m.id === id)).filter(Boolean) as MemberDto[];
                    list = [...dummies];
                    // 当選者をランダムな位置に挿入
                    const randomIndex = Math.floor(Math.random() * (list.length + 1));
                    list.splice(randomIndex, 0, winner);
                    console.log('★ [MemberDrawAnimation] Winner placed at random index:', randomIndex);
                } else {
                    list = allMembers.slice(0, props.visibleCount);
                }
            } else {
                list = allMembers.slice(0, props.visibleCount);
            }

            while (list.length < props.visibleCount) {
                list.push({ id: 'empty-' + list.length, name: '---', photoAssetId: undefined, rank: 0 } as MemberDto);
            }
            displayMembers.value = [...list, ...list, ...list, ...list, ...list, ...list, ...list, ...list, ...list, ...list];
        };

        // Ensure the planned winner (if provided) is included in the visible display list.
        // Called from startDraw so stopAt can locate the planned winner among duplicated items.
        const ensureWinnerInDisplay = async (winnerId: string | null) => {
            const visible = Math.max(props.visibleCount ?? 1, 1);
            if (!winnerId) {
                buildDisplay();
                return;
            }

            const all = props.members.slice();
            const winner = all.find((m: MemberDto) => m.id === winnerId) || null;

            let list: MemberDto[] = [];
            if (winner) {
                const withoutWinner = all.filter((m: MemberDto) => m.id !== winnerId);
                list = withoutWinner.slice(0, Math.max(visible - 1, 0));
                // 当選者をランダムな位置に挿入
                const randomIndex = Math.floor(Math.random() * (list.length + 1));
                list.splice(randomIndex, 0, winner);
                console.log('[MemberDrawAnimation] ensureWinnerInDisplay: Winner placed at random index:', randomIndex);
            } else {
                list = all.slice(0, visible);
            }

            while (list.length < visible) {
                list.push({ id: 'empty-' + list.length, name: '---', photoAssetId: undefined, rank: 0 } as MemberDto);
            }

            const seen = new Set<string>();
            const unique: MemberDto[] = [];
            for (const m of list) {
                if (!seen.has(m.id)) {
                    seen.add(m.id);
                    unique.push(m);
                }
            }

            displayMembers.value = [...unique, ...unique, ...unique, ...unique, ...unique, ...unique, ...unique, ...unique, ...unique, ...unique];

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

        const loadImages = async () => {
            const base = displayMembers.value.slice(0, Math.max(displayMembers.value.length / 2, 0));
            for (const m of base) {
                const aid = m?.photoAssetId;
                if (!aid) continue;
                if (memberImageMap.has(aid)) continue;
                try {
                    const asset = await assetService.getAssetDataById(aid);
                    if (!asset) continue;
                    // asset may contain blob, dataUrl, or url depending on implementation
                    if ((asset as any).blob) {
                        const url = URL.createObjectURL((asset as any).blob);
                        memberImageMap.set(aid, url);
                    } else if ((asset as any).dataUrl) {
                        memberImageMap.set(aid, (asset as any).dataUrl);
                    } else if ((asset as any).url) {
                        memberImageMap.set(aid, (asset as any).url);
                    }
                } catch (e) {
                    // ignore individual load failures; fallback image will be used
                }
            }
        };

        const activeIndex = ref<number | null>(null);
        let rafId: number | null = null;
        const isAnimating = ref(false);

        const scales = ref<number[]>([]);

        const showWinnerDialog = ref(false);
        const winnerAssetId = ref('');
        const winnerName = ref('');
        const winnerTitle = computed(() => {
            const name = (winnerName.value || '').toString().trim();
            const display = name || (winnerAssetId.value ? winnerAssetId.value : '当選者');
            // explicit newline so the title does not wrap automatically; the CSS will use `white-space: pre`.
            return `${display} さん当選されました！\n前に出てきてください！`;
        });

        const winnerImageUrl = computed(() => {
            const id = winnerAssetId.value || '';
            return memberImageMap.get(id) || defaultAvatar;
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

            // tuning constants
            const maxScale = 1.8; // scale at exact center
            const minScale = 0.8; // scale far from center
            const influence = viewportRect.width / 2; // distance at which scale reaches min

            for (let i = 0; i < children.length; i++) {
                const c = children[i];
                const r = c.getBoundingClientRect();
                const center = r.left + r.width / 2;
                const dist = Math.abs(center - viewportCenter);

                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                }

                // continuous scale mapping: closer -> larger
                const ratio = Math.min(1, dist / Math.max(1, influence));
                const scale = minScale + (1 - ratio) * (maxScale - minScale);
                scales.value[i] = Number(scale.toFixed(3));
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
            const screenBottom = window.innerHeight;
            const midpoint = (centerY + screenBottom) / 2;
            const btn = startButtonContainer.value;
            // use viewport-fixed positioning so the button is always relative to the window
            btn.style.position = 'fixed';
            // Compute clamped top so the button center never goes outside the viewport
            try {
                const btnHeight = btn.offsetHeight || parseInt(getComputedStyle(btn).height || '0') || 0;
                const padding = 12; // minimum distance from viewport edge in px
                const minCenter = btnHeight / 2 + padding;
                const maxCenter = window.innerHeight - (btnHeight / 2) - padding;
                // clamp midpoint between minCenter and maxCenter
                const clamped = Math.max(minCenter, Math.min(midpoint, maxCenter));
                // set vertical center using translateY; horizontal centering is handled by CSS flex
                // apply a small downward bias so the button sits a bit lower visually
                const verticalOffset = 40; // pixels to nudge the button down
                const biased = Math.min(clamped + verticalOffset, maxCenter);
                btn.style.top = `${biased}px`;
                btn.style.transform = 'translateY(-50%)';
            } catch (e) {
                // fallback to original midpoint if any measurement fails
                btn.style.top = `${midpoint}px`;
                btn.style.transform = 'translateY(-50%)';
            }
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

        const stopAt = (memberId: string | null): Promise<string | null> => {
            return new Promise((resolve) => {
                if (!track.value || !viewport.value) {
                    resolve(null);
                    return;
                }
                console.log('[MemberDrawAnimation] stopAt called', { memberId, displayMembersCount: displayMembers.value.length });
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

                let targetChildIdx = -1;
                if (memberId) {
                    const candidates: number[] = [];
                    for (let i = 0; i < children.length; i++) {
                        if ((displayMembers.value[i]?.id ?? null) === memberId) candidates.push(i);
                    }
                    console.log('[MemberDrawAnimation] stopAt: candidateIndexes', candidates);
                    if (candidates.length) {
                        targetChildIdx = candidates.reduce((best, cur) => childCenterDist(cur) < childCenterDist(best) ? cur : best, candidates[0]);
                    }
                }

                // fallback: if no memberId match or not found, pick a random member from the base set
                if (targetChildIdx === -1) {
                    const baseLen = Math.floor(displayMembers.value.length / 2) || displayMembers.value.length;
                    const randomBaseIdx = Math.floor(Math.random() * baseLen);
                    const candidates: number[] = [];
                    for (let i = 0; i < children.length; i++) {
                        if ((displayMembers.value[i]?.id ?? null) === displayMembers.value[randomBaseIdx]?.id) candidates.push(i);
                    }
                    if (candidates.length) {
                        targetChildIdx = candidates.reduce((best, cur) => childCenterDist(cur) < childCenterDist(best) ? cur : best, candidates[0]);
                    } else {
                        // as ultimate fallback pick the visible child closest to center
                        let bestIdx = 0;
                        let bestDist = Infinity;
                        for (let i = 0; i < children.length; i++) {
                            const d = childCenterDist(i);
                            if (d < bestDist) {
                                bestDist = d;
                                bestIdx = i;
                            }
                        }
                        targetChildIdx = bestIdx;
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

                const patterns = [
                    (tl: gsap.core.Timeline) => {
                        tl.to(track.value, { x: finalX, duration: 3.0, ease: 'power2.out' });
                    },
                    (tl: gsap.core.Timeline) => {
                        const overshoot = finalX - 150;
                        tl.to(track.value, { x: overshoot, duration: 1.0, ease: 'power2.out' })
                            .to(track.value, { x: finalX + 60, duration: 1.0, ease: 'power1.inOut' }, "+=0.2")
                            .to(track.value, { x: finalX, duration: 1.0, ease: 'bounce.out' });
                    },
                    (tl: gsap.core.Timeline) => {
                        tl.to(track.value, { x: finalX - 90, duration: 1.0, ease: 'power2.out' })
                            .to(track.value, { x: finalX + 90, duration: 1.0, ease: 'power1.inOut' })
                            .to(track.value, { x: finalX, duration: 1.5, ease: 'elastic.out(1, 0.3)' });
                    }
                ];

                const pattern = patterns[Math.floor(Math.random() * patterns.length)];
                const tl = gsap.timeline({
                    onComplete: () => {
                        const id = displayMembers.value[targetChildIdx]?.id ?? null;
                        activeIndex.value = targetChildIdx;
                        console.log('[MemberDrawAnimation] stopAt: chosen', {
                            targetChildIdx,
                            chosenId: id,
                            chosenName: displayMembers.value[targetChildIdx]?.name,
                        });
                        emit('stopped', id);
                        stopActiveLoop();
                        try { isAnimating.value = false; } catch (e) { }
                        try { positionStartButton(); } catch (e) { }
                        // Set winner info and show dialog
                        const winner = displayMembers.value[targetChildIdx];
                        if (winner) {
                            winnerAssetId.value = winner.photoAssetId || '';
                            winnerName.value = winner.name;
                            console.log('[MemberDrawAnimation] stopAt: winner info set', {
                                winnerId: winner.id,
                                winnerName: winner.name,
                                winnerAssetId: winner.photoAssetId,
                                externalDialog: props.externalDialog,
                            });
                            // only show the internal dialog when the parent is NOT handling the dialog
                            try {
                                if (!props.externalDialog) showWinnerDialog.value = true;
                            } catch (e) {
                                // defensive: if props aren't available for any reason, default to showing
                                showWinnerDialog.value = true;
                            }
                            console.log('[MemberDrawAnimation] stopAt: showWinnerDialog=', showWinnerDialog.value);
                        }
                        resolve(id);
                    }
                });
                pattern(tl);
            });
        };

        // High-level: start the draw by requesting a planned winner then animating
        // Start the animation with an externally-provided planned winner id.
        // The actual draw logic (remote call / winner selection) must be done
        // by an external orchestrator (e.g. draw-orchestrator-view.vue). This
        // component only receives the planned id and performs the animation.
        const startDraw = (winnerId?: string | null) => {
            plannedWinnerId = winnerId ?? null;
            console.log('[MemberDrawAnimation] startDraw plannedWinnerId=', plannedWinnerId);
            // Ensure winner is part of the displayed set before starting animation
            void (async () => {
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
            const id = await stopAt(plannedWinnerId || null);
            try { await stop(); } catch (e) { /* ignore */ }
            emit('member-selected', id);
            plannedWinnerId = null;
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
            for (const url of Array.from(memberImageMap.values())) try { URL.revokeObjectURL(url); } catch (e) { }
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

        watch(showWinnerDialog, async (newVal) => {
            if (newVal) {
                document.body.style.overflow = 'hidden';
                // wait for DOM update then focus the primary action so Enter works reliably
                try {
                    await nextTick();
                    // notify parent immediately so it can lock input
                    try { emit('winner-dialog-shown'); } catch (e) { }
                    // delay focusing the button by 1s so that a held Enter doesn't immediately activate it
                    setTimeout(() => {
                        try { nextBtn.value?.focus(); } catch (e) { }
                    }, 1000);
                } catch (e) {
                    // ignore focus errors
                }
            } else {
                document.body.style.overflow = '';
                // notify parent that the internal winner dialog was closed
                try { emit('winner-dialog-closed'); } catch (e) { }
            }
        });

        const closeWinnerDialog = () => {
            showWinnerDialog.value = false;
            // notify parent that the dialog was closed (keeps API consistent)
            try { emit('close-winner-dialog'); } catch (e) { }
        };

        const handleStart = () => {
            emit('start');
        };

        return { viewport, track, startButtonContainer, nextBtn, displayMembers, memberImageMap, defaultAvatar, start, stopAt, activeIndex, startDraw, stopDraw, handleStart, scales, isAnimating, showWinnerDialog, winnerAssetId, winnerName, winnerTitle, winnerImageUrl, closeWinnerDialog };
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
    border-radius: 8px;
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
    background: linear-gradient(90deg, #6d28d9, #ec4899);
    color: white;
    padding: 28px 56px;
    border-radius: 24px;
    font-weight: 700;
    font-size: clamp(28px, 4.5vw, 48px);
    border: none;
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
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 40px rgba(255, 255, 255, 1), 0 0 60px rgba(108, 40, 217, 0.5);
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

<style scoped>
/* Inline dialog styles copied/adjusted from draw-result-dialog for the embedded modal */
.dialog-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    z-index: 10000;
}

.dialog-content {
    background: #000;
    border-radius: 20px;
    padding: 48px;
    width: 760px;
    box-sizing: border-box;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    border: 2px solid #ffd700;
}

.dialog-title {
    font-size: 3rem;
    font-weight: 900;
    margin-bottom: 18px;
    color: #ffffff !important;
    text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6);
    /* preserve explicit newlines and prevent automatic wrapping */
    white-space: pre;
    word-break: normal;
}

.dialog-image-wrap {
    margin-bottom: 12px;
}

.modal-image {
    max-width: 460px;
    max-height: 460px;
    object-fit: cover;
    display: block;
    margin: 0 auto 20px auto;
    border-radius: 12px;
    border: 3px solid #ffd700;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
}

.dialog-actions {
    margin-top: 18px;
}

.btn-primary {
    background: linear-gradient(90deg, #ffd700, #ff6b35);
    color: black;
    padding: 20px 56px;
    border-radius: 24px;
    border: none;
    cursor: pointer;
    font-weight: 900;
    font-size: 1.8rem;
    box-shadow: 0 10px 30px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 107, 53, 0.25);
}
</style>
