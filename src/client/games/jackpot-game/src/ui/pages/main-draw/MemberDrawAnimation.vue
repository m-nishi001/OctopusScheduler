<template>
    <div class="member-draw">
        <div class="viewport" ref="viewport">
            <div class="track" ref="track">
                <div v-for="(m, idx) in displayMembers" :key="m.id + '-' + idx"
                    :class="['member-item', { active: idx === (activeIndex ?? -999), left1: idx === ((activeIndex ?? -999) - 1), right1: idx === ((activeIndex ?? -999) + 1) }]">
                    <img :src="memberImageMap.get(m.photoAssetId || '') || defaultAvatar" alt="member" />
                    <div class="name">{{ m.name }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import gsap from 'gsap';
import type { MemberDto } from '../../../model/applications/member/dto/member-dto';
import { container } from 'tsyringe';
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';

// Per-animation defaults (hardcoded here per your request)
export const MEMBER_DRAW_REQUEST_COUNT = 10;
export const MEMBER_DUMMY_DISPLAY_COUNT = 0;

export default {
    name: 'MemberDrawAnimation',
    props: {
        members: { type: Array as () => MemberDto[], default: () => [] },
        visibleCount: { type: Number, default: 10 },
        autoStart: { type: Boolean, default: false }
    },
    setup(props: any, { emit }: any) {
        const viewport = ref<HTMLDivElement | null>(null);
        const track = ref<HTMLDivElement | null>(null);
        const tweenRef: { tween: gsap.core.Tween | null } = { tween: null };
        const memberImageMap = new Map<string, string>();
        const defaultAvatar = '';

        const assetService = container.resolve(AssetDataService);

        // duplicate members to create a looping track
        const displayMembers = ref<MemberDto[]>([]);

        const buildDisplay = () => {
            const list = props.members.slice(0, Math.max(props.visibleCount, 1));
            // ensure at least visibleCount items
            while (list.length < props.visibleCount) {
                list.push({ id: 'empty-' + list.length, name: '---', photoAssetId: undefined, rank: 0 } as MemberDto);
            }
            // duplicate twice for smooth loop
            displayMembers.value = [...list, ...list];
        };

        const loadImages = async () => {
            for (const m of props.members) {
                if (m.photoAssetId && !memberImageMap.has(m.photoAssetId)) {
                    try {
                        const asset = await assetService.getAssetDataById(m.photoAssetId);
                        if (asset && asset.blob) {
                            const url = URL.createObjectURL(asset.blob);
                            memberImageMap.set(m.photoAssetId, url);
                        }
                    } catch (e) { }
                }
            }
        };

        const activeIndex = ref<number | null>(null);

        const start = (speed = 200) => {
            if (!track.value || !viewport.value) return;
            gsap.killTweensOf(track.value);
            const trackWidth = track.value.scrollWidth / 2; // since duplicated
            // animate left by trackWidth in px repeatedly
            tweenRef.tween = gsap.to(track.value, { x: `-=${trackWidth}px`, duration: trackWidth / speed, ease: 'none', repeat: -1 });
        };

        const stopAt = (memberId: string | null): Promise<string | null> => {
            return new Promise((resolve) => {
                if (!track.value || !viewport.value) {
                    resolve(null);
                    return;
                }
                // stop continuous tween
                if (tweenRef.tween) tweenRef.tween.kill();

                // find index of memberId in the first half
                const baseList = displayMembers.value.slice(0, displayMembers.value.length / 2);
                let idx = -1;
                if (memberId) idx = baseList.findIndex((m) => m.id === memberId);
                if (idx < 0) idx = Math.floor(Math.random() * baseList.length);

                // compute target translateX so that the selected item is centered in viewport
                const item = track.value.children[idx] as HTMLElement;
                if (!item) {
                    resolve(null);
                    return;
                }
                const viewportRect = viewport.value.getBoundingClientRect();
                const itemRect = item.getBoundingClientRect();
                const currentTransform = gsap.getProperty(track.value, 'x') as number || 0;
                const itemCenter = itemRect.left + itemRect.width / 2;
                const viewportCenter = viewportRect.left + viewportRect.width / 2;
                const delta = viewportCenter - itemCenter;
                // animate by delta amount (consider existing transform)
                gsap.to(track.value, {
                    x: currentTransform + delta,
                    duration: 1.6,
                    ease: 'power3.out',
                    onComplete: () => {
                        const id = displayMembers.value[idx]?.id ?? null;
                        // mark active index (choose the same idx in the first half)
                        activeIndex.value = idx;
                        // emit Vue event
                        emit('stopped', id);
                        resolve(id);
                    }
                });
            });
        };

        const runAutoReroll = async (opts: { dummyId?: string | null; finalId?: string | null; dummyMs?: number }): Promise<string | null> => {
            const { dummyId = null, finalId = null, dummyMs = 2000 } = opts || {};
            start();
            await new Promise((r) => setTimeout(r, dummyMs));
            await stopAt(dummyId);
            // short pause
            await new Promise(r => setTimeout(r, 600));
            start();
            await new Promise(r => setTimeout(r, 80));
            const final = await stopAt(finalId);
            activeIndex.value = displayMembers.value.findIndex((m) => m.id === final);
            return final;
        };

        onMounted(async () => {
            buildDisplay();
            await loadImages();
            if (props.autoStart) start();
            window.addEventListener('keydown', onKey);
        });

        onUnmounted(() => {
            if (tweenRef.tween) tweenRef.tween.kill();
            for (const url of memberImageMap.values()) try { URL.revokeObjectURL(url); } catch (e) { }
            window.removeEventListener('keydown', onKey);
        });

        function onKey(e: KeyboardEvent) {
            if (e.key === 'Enter') {
                // toggle stop/start
                if (tweenRef.tween) {
                    // stop at random (parent should call stopAt with real id)
                    tweenRef.tween.kill();
                } else {
                    start();
                }
            }
        }

        watch(() => props.members, async () => {
            buildDisplay();
            await loadImages();
        });

        return { viewport, track, displayMembers, memberImageMap, defaultAvatar, start, stopAt, runAutoReroll, activeIndex };
    }
};
</script>

<style scoped>
.member-draw {
    width: 100%;
}

.viewport {
    width: 100%;
    overflow: hidden;
}

.track {
    display: flex;
    align-items: center;
}

.member-item {
    width: 120px;
    flex: 0 0 120px;
    text-align: center;
    padding: 8px;
    box-sizing: border-box;
    transition: transform 220ms ease, opacity 200ms ease;
    opacity: 0.9;
}

.member-item img {
    width: 96px;
    height: 96px;
    border-radius: 8px;
    object-fit: cover;
    display: block;
    margin: 0 auto 6px auto;
    transition: transform 220ms ease, filter 220ms ease;
}

.member-item .name {
    font-weight: 700;
    color: #fff;
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
</style>
