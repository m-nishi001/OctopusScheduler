<template>
    <div class="opening-container" ref="containerEl">
        <div class="scroll-wrapper">
            <div class="scroll-content" ref="scrollContent">
                <div v-for="(el, idx) in screenConfig?.contents || []" :key="idx" class="content-item" :data-index="idx"
                    v-show="idx === currentIndex">
                    <template v-if="el.type === 'text'">
                        <div v-html="formatText(el.text || el.content)"></div>
                    </template>
                    <template v-else-if="el.type === 'image'">
                        <img :src="el.assetUrl" style="max-width:80%;" />
                    </template>
                    <template v-else-if="el.type === 'html'">
                        <div v-html="renderElementHtml(el)"></div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import gsap from 'gsap';
import { useRouter } from 'vue-router';

export default {
    name: 'OpeningSequence',
    props: {
        screenConfig: { type: Object, required: true }
    },
    setup(props: any) {
        const router = useRouter();
        const containerEl = ref<HTMLElement | null>(null);
        const scrollContent = ref<HTMLElement | null>(null);
        const currentIndex = ref<number>(-1);
        const currentTween = ref<gsap.core.Tween | gsap.core.Timeline | null>(null);
        let cancelled = false;

        const animateItem = (el: HTMLElement, durationMs: number, direction: string) => {
            return new Promise<void>((resolve) => {
                const viewportWidth = (containerEl.value && containerEl.value.clientWidth) || window.innerWidth;
                const viewportHeight = (containerEl.value && containerEl.value.clientHeight) || window.innerHeight;

                const rect = el.getBoundingClientRect();
                const elWidth = rect.width || el.offsetWidth || 0;
                const elHeight = rect.height || el.offsetHeight || 0;

                gsap.set(el, { position: 'absolute', left: '50%', top: '50%', xPercent: -50, yPercent: -50, x: 0, y: 0, opacity: 0 });

                let travelX = 0;
                let travelY = 0;
                let startX = 0;
                let startY = 0;
                let endX = 0;
                let endY = 0;

                if (direction === 'up') {
                    travelY = viewportHeight / 2 + elHeight / 2 + 20;
                    startY = travelY;
                    endY = -travelY;
                } else if (direction === 'down') {
                    travelY = viewportHeight / 2 + elHeight / 2 + 20;
                    startY = -travelY;
                    endY = travelY;
                } else if (direction === 'left') {
                    travelX = viewportWidth / 2 + elWidth / 2 + 20;
                    startX = travelX;
                    endX = -travelX;
                } else if (direction === 'right') {
                    travelX = viewportWidth / 2 + elWidth / 2 + 20;
                    startX = -travelX;
                    endX = travelX;
                }

                gsap.set(el, { x: startX, y: startY, opacity: 1 });

                currentTween.value = gsap.to(el, {
                    x: endX,
                    y: endY,
                    duration: Math.max(0.5, durationMs / 1000),
                    ease: 'linear',
                    onComplete: () => {
                        currentTween.value = null;
                        resolve();
                    }
                });
            });
        };

        const formatText = (s: string) => {
            return (s || '').replace(/\n/g, '<br/>');
        };

        const renderElementHtml = (el: any) => {
            const raw = el.content || '';
            const hasHtmlTag = /<[^>]+>/.test(raw);
            const escapeHtml = (str: string) =>
                str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            return hasHtmlTag ? raw : escapeHtml(raw).replace(/\n/g, '<br/>');
        };

        const startSequence = async () => {
            if (!scrollContent.value || !props.screenConfig) return;
            const elements = Array.from(scrollContent.value.querySelectorAll('.content-item')) as HTMLElement[];
            elements.forEach(el => gsap.set(el, { opacity: 0 }));

            for (let i = 0; i < elements.length; i++) {
                if (cancelled) break;
                currentIndex.value = i;
                await nextTick();
                const el = elements[i];
                const elementConfig = props.screenConfig.contents[i];
                await new Promise((r) => setTimeout(r, 60));

                const durationMs = elementConfig?.duration || elementConfig?.animation?.duration || 3000;
                const animationType = elementConfig?.animation?.type || elementConfig?.effect || 'fade';
                const direction = elementConfig?.animation?.scrollDirection || elementConfig?.scrollDirection || 'up';

                if (animationType === 'scroll') {
                    await animateItem(el, durationMs, direction);
                } else if (animationType === 'fade') {
                    gsap.set(el, { position: 'absolute', left: '50%', top: '50%', xPercent: -50, yPercent: -50, opacity: 0 });
                    await new Promise<void>((resolve) => {
                        currentTween.value = gsap.timeline({ onComplete: () => { currentTween.value = null; resolve(); } })
                            .to(el, { opacity: 1, duration: Math.min(0.8, durationMs / 2000) })
                            .to({}, { duration: Math.max(0, (durationMs - 800) / 1000) })
                            .to(el, { opacity: 0, duration: Math.min(0.8, durationMs / 2000) });
                    });
                } else if (animationType === 'static') {
                    gsap.set(el, { position: 'absolute', left: '50%', top: '50%', xPercent: -50, yPercent: -50, opacity: 1 });
                    await new Promise((r) => setTimeout(r, durationMs));
                } else {
                    gsap.set(el, { opacity: 1 });
                    await new Promise((r) => setTimeout(r, durationMs));
                }

                if (el) {
                    gsap.set(el, { clearProps: 'position,left,top,xPercent,yPercent,x,y,opacity' });
                }
            }

            if (!cancelled) {
                router.push('/jackpot-description');
            }
        };

        onMounted(async () => {
            // If elements are configured to scroll downward, reverse their order
            const maybeReverseForDownScroll = (cfg: any) => {
                if (!cfg || !Array.isArray(cfg.contents) || cfg.contents.length <= 1) return;
                const indexed = cfg.contents.map((el: any, idx: number) => ({ el, idx }));
                const scrollIndexed = indexed.filter((x: any) => {
                    const t = x.el?.animation?.type || x.el?.effect || '';
                    return t === 'scroll';
                });
                if (scrollIndexed.length === 0) return;
                const allDown = scrollIndexed.every((x: any) => {
                    const dir = x.el?.animation?.scrollDirection || x.el?.scrollDirection || 'up';
                    return dir === 'down';
                });
                if (!allDown) return;
                const reversed = [...cfg.contents];
                const scrollItems = scrollIndexed.map((x: any) => x.el).reverse();
                for (let i = 0; i < scrollIndexed.length; i++) {
                    reversed[scrollIndexed[i].idx] = scrollItems[i];
                }
                cfg.contents = reversed;
            };

            maybeReverseForDownScroll(props.screenConfig);
            await nextTick();
            startSequence();
        });

        onUnmounted(() => {
            cancelled = true;
            currentTween.value?.kill();
        });

        return { containerEl, scrollContent, currentIndex, formatText, renderElementHtml };
    }
};
</script>

<style scoped>
.opening-container {
    height: 100vh;
    overflow: hidden;
    background: black;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center
}

.scroll-content {
    text-align: center;
    color: #fff;
    font-size: 2em;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5)
}

.content-item {
    margin: 0;
    position: relative;
    left: 0;
    top: 0;
    transform: none;
    width: 100%;
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    overflow: hidden
}

.content-item img {
    max-width: 100%;
    height: auto;
    display: block
}

.content-item>div,
.content-item>* {
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: anywhere
}

.scroll-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start
}

.scroll-content {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden
}
</style>
