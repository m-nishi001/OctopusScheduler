<template>
  <MainLayout :fullScreen="true">
    <div class="opening-container" ref="containerEl">
      <div v-if="screenHtml" class="html-content" v-html="screenHtml"></div>

      <div v-else class="scroll-wrapper">
        <div class="scroll-content" ref="scrollContent">
          <div v-for="(el, idx) in screenConfig?.elements || []" :key="el.id" class="content-item" :data-index="idx"
            v-show="idx === currentIndex">
            <template v-if="el.type === 'text'">
              <div v-html="formatText(el.content)"></div>
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
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import gsap from 'gsap';
import { container } from 'tsyringe';
import { ScreenConfigService } from '../../../model/applications/screen-config-service';

export default {
  name: 'OpeningView',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    const containerEl = ref<HTMLElement | null>(null);
    const scrollContent = ref<HTMLElement | null>(null);
    const screenConfigService = container.resolve(ScreenConfigService);
    const screenConfig = ref<any | null>(null);
    const screenHtml = ref<string | null>(null);
    const bgm = ref<HTMLAudioElement | null>(null);
    const currentIndex = ref<number>(-1);
    const currentTween = ref<gsap.core.Tween | gsap.core.Timeline | null>(null);
    let cancelled = false;

    const animateItem = (el: HTMLElement, durationMs: number, direction: string) => {
      return new Promise<void>((resolve) => {
        // allow fallback to window sizes if containerRef is not yet available
        const viewportWidth = (containerEl.value && containerEl.value.clientWidth) || window.innerWidth;
        const viewportHeight = (containerEl.value && containerEl.value.clientHeight) || window.innerHeight;

        // measure element height
        const rect = el.getBoundingClientRect();
        const elWidth = rect.width || el.offsetWidth || 0;
        const elHeight = rect.height || el.offsetHeight || 0;

        // center element in container and use transform to animate
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

        // place at start
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

    const startSequence = async () => {
      if (!scrollContent.value || !screenConfig.value) return;
      const elements = Array.from(scrollContent.value.querySelectorAll('.content-item')) as HTMLElement[];

      // hide all elements initially to prevent flicker
      elements.forEach(el => gsap.set(el, { opacity: 0 }));

      for (let i = 0; i < elements.length; i++) {
        if (cancelled) break;
        currentIndex.value = i;
        // wait for DOM to update so measurements are correct
        await nextTick();
        const el = elements[i];
        const elementConfig = screenConfig.value.elements[i];

        // if element contains images, wait briefly for layout
        await new Promise((r) => setTimeout(r, 60));

        const durationMs = elementConfig?.duration || elementConfig?.animation?.duration || 3000;
        const animationType = elementConfig?.animation?.type || elementConfig?.effect || 'fade';
        const direction = elementConfig?.animation?.scrollDirection || elementConfig?.scrollDirection || 'up';

        if (animationType === 'scroll') {
          await animateItem(el, durationMs, direction);
        } else if (animationType === 'fade') {
          // fade-in, hold, fade-out
          gsap.set(el, { position: 'absolute', left: '50%', top: '50%', xPercent: -50, yPercent: -50, opacity: 0 });
          await new Promise<void>((resolve) => {
            currentTween.value = gsap.timeline({ onComplete: () => { currentTween.value = null; resolve(); } })
              .to(el, { opacity: 1, duration: Math.min(0.8, durationMs / 2000) })
              .to({}, { duration: Math.max(0, (durationMs - 800) / 1000) })
              .to(el, { opacity: 0, duration: Math.min(0.8, durationMs / 2000) });
          });
        } else if (animationType === 'static') {
          // static: show centered for duration without movement
          gsap.set(el, { position: 'absolute', left: '50%', top: '50%', xPercent: -50, yPercent: -50, opacity: 1 });
          await new Promise((r) => setTimeout(r, durationMs));
        } else {
          // unknown types: fallback to simple display
          gsap.set(el, { opacity: 1 });
          await new Promise((r) => setTimeout(r, durationMs));
        }

        // after animation, hide element and continue
        if (el) {
          // clear positioning for cleanliness
          gsap.set(el, { clearProps: 'position,left,top,xPercent,yPercent,x,y,opacity' });
        }
      }

      if (!cancelled) {
        bgm.value?.pause();
        router.push('/jackpot-description');
      }
    };

    const formatText = (s: string) => {
      return (s || '').replace(/\\n/g, '<br/>');
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

    onMounted(async () => {
      screenConfig.value = await screenConfigService.fetchScreenConfig('opening');

      // initialize bgm early so it plays during sequences or fullscreen HTML
      if (screenConfig.value?.bgmAssetUrl) {
        bgm.value = new Audio(screenConfig.value.bgmAssetUrl);
        bgm.value.loop = true;
        setTimeout(() => bgm.value?.play().catch(() => { }), 500);
      }
      // If displayMode requests fullscreen HTML, render only the first html element in fullscreen
      const htmlEl = screenConfig.value?.elements?.find((e: any) => e.type === 'html');
      if (screenConfig.value?.displayMode === 'html' && htmlEl) {
        const raw = htmlEl.content || '';
        const hasHtmlTag = /<[^>]+>/.test(raw);
        const escapeHtml = (str: string) =>
          str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const contentHtml = hasHtmlTag ? raw : `<div class="centered-html">${escapeHtml(raw).replace(/\n/g, '<br/>')}</div>`;
        screenHtml.value = contentHtml;

        // wait for images inside .html-content to load before starting duration timer
        await nextTick();
        const htmlContainer = document.querySelector('.html-content') as HTMLElement | null;
        const waitForImagesIn = (el: HTMLElement | null) =>
          new Promise<void>((resolve) => {
            if (!el) return resolve();
            const imgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
            if (imgs.length === 0) return resolve();
            let remaining = imgs.length;
            imgs.forEach((img) => {
              if (img.complete) {
                remaining -= 1;
                if (remaining === 0) resolve();
              } else {
                img.addEventListener('load', () => {
                  remaining -= 1;
                  if (remaining === 0) resolve();
                });
                img.addEventListener('error', () => {
                  remaining -= 1;
                  if (remaining === 0) resolve();
                });
              }
            });
          });

        await waitForImagesIn(htmlContainer);

        // schedule navigation after element's duration (if present)
        const durationMs = htmlEl.animation?.duration || 3000;
        setTimeout(() => {
          bgm.value?.pause();
          router.push('/jackpot-description');
        }, durationMs);
      } else {
        // In non-fullscreen mode, render all elements (including html) in the DOM and run sequence
        // ensure DOM updates are flushed, then start sequence immediately
        await nextTick();
        startSequence();
      }
    });

    onUnmounted(() => {
      cancelled = true;
      currentTween.value?.kill();
      bgm.value?.pause();
    });

    return { containerEl, scrollContent, screenConfig, screenHtml, formatText, currentIndex, renderElementHtml };
  },
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
  align-items: center;
}

.scroll-content {
  text-align: center;
  color: #fff;
  font-size: 2em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.scroll-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 40px 0;
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
  overflow: hidden;
}

.html-content {
  width: 100vw;
  height: 100vh;
  overflow: auto;
}

/* Ensure any text or images inside content-item don't exceed container */
.content-item img {
  max-width: 100%;
  height: auto;
  display: block;
}

.content-item>div,
.content-item>* {
  max-width: 100%;
  box-sizing: border-box;
  overflow-wrap: anywhere;
}

.centered-html {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  color: #fff;
  text-align: center;
  font-size: 2em;
}

.scroll-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.scroll-content {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
