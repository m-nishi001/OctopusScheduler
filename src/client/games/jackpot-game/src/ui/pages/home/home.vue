<template>
  <MainLayout>
    <div class="home-root">
      <ThreeHero :loaded="assetsLoaded" class="bg-hero" />

      <div class="home-overlay">
        <h1 class="home-title">{{ homeConfig?.title }}</h1>

        <p v-if="homeConfig?.subtitle" class="subtitle">{{ homeConfig.subtitle }}</p>

        <div class="controls">
          <button v-if="assetsLoaded" ref="startBtn" @click="goOpening" class="start-button">スタート</button>
          <button ref="adminBtn" @click="goAdmin" class="admin-button">管理画面</button>
        </div>

        <div v-if="!assetsLoaded" class="load-footer">
          <div class="progress-wrap">
            <div class="progress-line" :style="{ width: progress + '%' }"></div>
          </div>
          <div v-for="task in syncTasks" :key="task.label" class="progress-text">{{ task.label }}: {{ task.status }}{{
            task.total > 0 ? (task.status === '同期中' ? ` (${task.current}件/${task.total}件)` : `
            (${task.total}件)`) : '' }}
          </div>
        </div>
      </div>
    </div>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import MainLayout from '../common/main-layout.vue';
import ThreeHero from '../../shared/graphics/three-hero.vue';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { Container } from '../../../core/container';
import { ScreenConfigService } from '../../../model/applications/screen-config/screen-config-service';
import { DriveDataService } from '../../../model/applications/asset/drive-data-service';
import { HomeScreenSetting } from '../../../model/domains/screen-config/home-screen-setting';

export default {
  name: 'Home',
  components: { MainLayout, ThreeHero },
  setup() {
    Container.register();

    const router = useRouter();
    const goOpening = () => router.push('/jackpot-opening');
    const goAdmin = () => router.push('/jackpot-admin');

    const homeConfig = ref<HomeScreenSetting | null>(null);
    const screenConfigService = container.resolve(ScreenConfigService);
    const assetService = container.resolve<DriveDataService>("DriveDataService");

    const assetsLoaded = ref(false);
    const progress = ref(0);
    const syncTasks = ref([
      { label: "アセット", status: "準備中", current: 0, total: 0 },
      { label: "賞品", status: "準備中", current: 0, total: 0 },
      { label: "抽選結果", status: "準備中", current: 0, total: 0 },
      { label: "メンバー", status: "準備中", current: 0, total: 0 },
      { label: "画面設定", status: "準備中", current: 0, total: 0 },
    ]);
    // button refs for animation
    const startBtn = ref<HTMLButtonElement | null>(null);
    const adminBtn = ref<HTMLButtonElement | null>(null);
    let gsap: any = null;

    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const unmounted = ref(false);

    const playBGM = async () => {
      if (!homeConfig.value || !homeConfig.value.homeBgm) return;
      const asset = await assetService.getDriveDataById(homeConfig.value.homeBgm);
      if (asset && asset.dataUrl) {
        bgmAudio.value = new Audio(asset.dataUrl);
        bgmAudio.value.loop = true;
        bgmAudio.value.volume = 0.5;
        try {
          await bgmAudio.value.play();
        } catch (e) {
          console.warn("BGM play failed:", e);
        }
      }
    };

    const loadAssets = async () => {
      try {
        progress.value = 10;
        const tasks = [
          {
            task: assetService.syncDriveData((_message, progressInfo) => {
              if (progressInfo) {
                syncTasks.value[0].current = progressInfo.current;
                syncTasks.value[0].total = progressInfo.total;
              }
            }), index: 0
          },
          { task: Promise.resolve({ synced: 0 }), index: 1 },
          { task: Promise.resolve({ synced: 0 }), index: 2 },
          { task: Promise.resolve({ synced: 0 }), index: 3 },
          { task: screenConfigService.syncScreenConfigs(), index: 4 },
        ];
        const totalTasks = tasks.length;
        const progressPerTask = 30 / totalTasks;
        await Promise.all(tasks.map(async ({ task, index }) => {
          syncTasks.value[index].status = "同期中";
          const result = await task;
          syncTasks.value[index].status = "完了";
          if ('updated' in result && 'deleted' in result) {
            syncTasks.value[index].total = result.updated + result.deleted;
          } else if ('synced' in result) {
            syncTasks.value[index].total = result.synced;
          }
          progress.value += progressPerTask;
        }));
      } catch (e) {
        progress.value = 50;
        syncTasks.value.forEach(t => { t.status = "エラー"; t.current = 0; t.total = 0; });
      }
      const config = await screenConfigService.fetchScreenConfig('home');
      homeConfig.value = config as HomeScreenSetting ?? new HomeScreenSetting("", "", "", "", "");

      for (let i = progress.value; i < 100;) {
        i = Math.min(i + 8, 100);
        progress.value = i;
        await new Promise((r) => setTimeout(r, 120));
      }
      progress.value = 100;
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

      await loadAssets();
      if (!unmounted.value) {
        await playBGM();
        window.addEventListener('keydown', handleKey);
      }
      // lazy load gsap to avoid bundling cost if not needed
      try { const mod = await import('gsap'); gsap = mod?.gsap || mod; } catch (e) { gsap = null; }
    });

    onUnmounted(() => {
      unmounted.value = true;
      window.removeEventListener('keydown', handleKey);
      document.documentElement.classList.remove('jackpot-fullscreen');
      document.body.classList.remove('jackpot-fullscreen');
      if (bgmAudio.value) {
        try { bgmAudio.value.pause(); } catch (e) { }
        bgmAudio.value = null;
      }
    });

    watch(progress, async (val) => {
      if (val === 100) {
        assetsLoaded.value = true;
      }
    });

    // animate buttons when loaded becomes true
    watch(assetsLoaded, async (val) => {
      if (!val) return;
      await nextTick();
      const s = startBtn.value;
      const a = adminBtn.value;
      if (gsap && s && a) {
        gsap.set([s, a], { scale: 0.8, opacity: 0, filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' });
        gsap.to(s, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.5)' });
        gsap.to(a, { scale: 1, opacity: 0.95, duration: 0.6, delay: 0.08, ease: 'back.out(1.4)' });
        // subtle pulsing glow on start button
        gsap.to(s, { boxShadow: '0px 18px 60px rgba(255,122,122,0.16)', duration: 1.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      } else if (s && a) {
        s.style.opacity = '1';
        a.style.opacity = '0.95';
      }
    });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') goOpening();
    };

    return { goOpening, goAdmin, homeConfig, progress, assetsLoaded, startBtn, adminBtn, syncTasks };
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

.load-footer {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: auto;
  z-index: 3;
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
