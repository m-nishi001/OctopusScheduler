<template>
  <MainLayout>
    <div class="home-root">
      <ThreeHero class="bg-hero" />

      <div class="home-overlay">
        <h1 class="home-title">{{ homeConfig?.title }}</h1>

        <p v-if="homeConfig?.subtitle" class="subtitle">{{ homeConfig.subtitle }}</p>

        <div class="controls">
          <button ref="startBtn" @click="goOpening" class="start-button">スタート</button>
          <button ref="adminBtn" @click="goAdmin" class="admin-button">管理画面</button>
        </div>
      </div>
    </div>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import MainLayout from '../common/main-layout.vue';
import ThreeHero from '../../shared/graphics/three-hero.vue';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { Container } from '../../../core/container';
import { ScreenSettingsService } from '../../../model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';
import { HomeScreenSetting } from '../../../model/domains/screen-config/home-screen-setting';

export default {
  name: 'Home',
  components: { MainLayout, ThreeHero },
  setup() {
    Container.register();

    const router = useRouter();
    const goOpening = async () => {

      try {
        await playButtonSE();
      } catch (e) {

      }
      router.push('/jackpot-opening');
    };
    const goAdmin = () => router.push('/jackpot-admin');

    const homeConfig = ref<HomeScreenSetting | null>(null);
    const screenSettingsService = container.resolve(ScreenSettingsService);
    const assetService = container.resolve(AssetDataService);

    const startBtn = ref<HTMLButtonElement | null>(null);
    const adminBtn = ref<HTMLButtonElement | null>(null);
    let gsap: any = null;

    const bgmAudio = ref<HTMLAudioElement | null>(null);
    let bgmObjectUrl: string | undefined;
    let bgmUserInteractHandler: ((evt: Event) => void) | null = null;

    const tryPlayAudioFromAsset = async (assetId: string | undefined, opts?: { loop?: boolean; volume?: number }) => {
      if (!assetId) return null;
      const asset = await assetService.getAssetDataById(assetId);
      if (!asset || !(asset as any).blob) return null;
      const blob = (asset as any).blob as Blob;
      const objUrl = URL.createObjectURL(blob);
      const audio = new Audio(objUrl);
      audio.loop = !!opts?.loop;
      audio.volume = typeof opts?.volume === 'number' ? opts!.volume! : 1;
      try {
        await audio.play();
        return { audio, objUrl };
      } catch (e) {

        try { audio.pause(); } catch (ex) { }
        try { URL.revokeObjectURL(objUrl); } catch (ex) { }
        throw e;
      }
    };

    const playButtonSE = async () => {
      if (!homeConfig.value || !homeConfig.value.buttonClikingSE) return null;
      try {
        const res = await tryPlayAudioFromAsset(homeConfig.value.buttonClikingSE, { loop: false, volume: 1 });

        if (res && res.audio) {
          res.audio.addEventListener('ended', () => {
            try { URL.revokeObjectURL(res.objUrl); } catch (e) { }
          }, { once: true });
        }
        return res?.audio ?? null;
      } catch (e) {

        return null;
      }
    };
    const unmounted = ref(false);

    const playBGM = async () => {
      if (!homeConfig.value || !homeConfig.value.homeBgm) return;

      if (bgmAudio.value) {
        try { bgmAudio.value.pause(); } catch (e) { }
        bgmAudio.value = null;
      }
      if (bgmObjectUrl) {
        try { URL.revokeObjectURL(bgmObjectUrl); } catch (e) { }
        bgmObjectUrl = undefined;
      }

      try {
        const res = await tryPlayAudioFromAsset(homeConfig.value.homeBgm, { loop: true, volume: 0.5 });
        if (res && res.audio) {
          bgmAudio.value = res.audio;
          bgmObjectUrl = res.objUrl;
        }
      } catch (e) {

        console.warn('BGM play failed (might be autoplay policy):', e);
        bgmUserInteractHandler = async (evt: Event) => {

          const target = evt.target as HTMLElement | null;
          if (!target) return;
          const isButton = target.closest && (target.closest('button') || target.getAttribute('role') === 'button');
          if (isButton) return;
          try {
            await playBGM();
          } catch (e) { }

          if (bgmUserInteractHandler) {
            document.body.removeEventListener('click', bgmUserInteractHandler as EventListener);
            document.body.removeEventListener('touchstart', bgmUserInteractHandler as EventListener);
            bgmUserInteractHandler = null;
          }
        };
        document.body.addEventListener('click', bgmUserInteractHandler as EventListener);
        document.body.addEventListener('touchstart', bgmUserInteractHandler as EventListener);
      }
    };



    onMounted(async () => {
      if (bgmAudio.value) {
        bgmAudio.value.pause();
        bgmAudio.value = null;
      }
      window.removeEventListener('keydown', handleKey);
// set global fullscreen class so body/html have no margin and no scrollbars for this view
      document.documentElement.classList.add('jackpot-fullscreen');
      document.body.classList.add('jackpot-fullscreen');

      (async () => {
        try {
          const config = await screenSettingsService.fetchScreenSetting('home', 'home-screen-settings');
          homeConfig.value = (config as HomeScreenSetting) ?? new HomeScreenSetting("", "", "", "", "");
          if (!unmounted.value) await playBGM();
          window.addEventListener('keydown', handleKey);
        } catch (e) {
          console.warn('fetchScreenSetting/playBGM failed:', e);
        }
      })();

      try { const mod = await import('gsap'); gsap = mod?.gsap || mod; } catch (e) { gsap = null; }
      await nextTick();
      const s = startBtn.value;
      const a = adminBtn.value;
      if (gsap && s && a) {
        gsap.set([s, a], { scale: 0.8, opacity: 0, filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' });
        gsap.to(s, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.5)' });
        gsap.to(a, { scale: 1, opacity: 0.95, duration: 0.6, delay: 0.08, ease: 'back.out(1.4)' });
        gsap.to(s, { boxShadow: '0px 18px 60px rgba(255,122,122,0.16)', duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      } else if (s && a) {
        s.style.opacity = '1';
        a.style.opacity = '0.95';
      }
    });

    onUnmounted(() => {
      unmounted.value = true;
      window.removeEventListener('keydown', handleKey);
      document.documentElement.classList.remove('jackpot-fullscreen');
      document.body.classList.remove('jackpot-fullscreen');

      if (bgmUserInteractHandler) {
        try {
          document.body.removeEventListener('click', bgmUserInteractHandler as EventListener);
          document.body.removeEventListener('touchstart', bgmUserInteractHandler as EventListener);
        } catch (e) { }
        bgmUserInteractHandler = null;
      }
      if (bgmAudio.value) {
        try { bgmAudio.value.pause(); } catch (e) { }
        bgmAudio.value = null;
      }
      if (bgmObjectUrl) {
        try { URL.revokeObjectURL(bgmObjectUrl); } catch (e) { }
        bgmObjectUrl = undefined;
      }
    });



    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') goOpening();
    };

    return { goOpening, goAdmin, homeConfig, startBtn, adminBtn };
  },
};
</script>

<style scoped>
.home-root {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.bg-hero {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.home-overlay {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  text-align: center;
  pointer-events: none;
}

.home-title {
  font-size: clamp(28px, 6vw, 56px);
  color: #fff;
  text-shadow: 0 8px 36px rgba(0, 0, 0, 0.6);
  margin-bottom: 12px;
  animation: titleAnimation 900ms cubic-bezier(.22, .9, .32, 1);
  pointer-events: auto;
}

.subtitle {
  color: rgba(255, 255, 255, 0.92);
  font-size: clamp(14px, 2.4vw, 18px);
  margin: 4px 0 8px;
}

.controls {
  display: flex;
  gap: 12px;
  margin-top: 18px;
  pointer-events: auto;
}

.start-button {
  padding: 12px 28px;
  border-radius: 12px;
  background: linear-gradient(90deg, #ffd26f, #ff7a7a);
  color: #111;
  border: none;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 30px rgba(255, 122, 122, 0.14);
}

.admin-button {
  padding: 10px 18px;
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
}

.progress-wrap {
  width: min(520px, 72vw);
  height: 12px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  overflow: hidden;
}

.progress-line {
  height: 100%;
  background: linear-gradient(90deg, #ffd36f, #ff7aa0);
  transition: width 220ms linear;
}

.progress-text {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.95rem;
}


@keyframes titleAnimation {
  from {
    transform: translateY(-8px) scale(.98);
    opacity: 0
  }

  to {
    transform: translateY(0) scale(1);
    opacity: 1
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px)
  }

  to {
    opacity: 1;
    transform: translateY(0)
  }
}
</style>

/* global rules to remove outer padding/margins and hide scrollbar while in fullscreen mode */
<style>
html.jackpot-fullscreen,
body.jackpot-fullscreen {
  height: 100%;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: radial-gradient(circle at 50% 30%, #1b0b05 0%, #0b0503 35%, #040203 100%) !important;
}

/* subtle stage spotlight for overlay readability */
.home-root::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 28%, rgba(255, 238, 200, 0.06) 0%, rgba(0, 0, 0, 0.45) 40%);
  z-index: 1;
  pointer-events: none;
}

.home-overlay {
  /* make overlay text warm and bold to match jackpot vibe */
  z-index: 3;
  text-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
}

.home-title {
  color: #fff0d9;
  letter-spacing: 0.6px
}

.subtitle {
  color: rgba(255, 220, 190, 0.9);
}

.start-button {
  background: linear-gradient(90deg, #ffd36f, #ff7a7a);
}
</style>
