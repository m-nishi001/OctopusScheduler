<template>
  <MainLayout>
    <div class="demo-root">
      <Loader v-if="!demoConfig" label="読み込み中..." />
      <div v-else class="demo-card">
        <h2 class="demo-title">デモ抽選画面</h2>

        <div v-if="!drawn" class="demo-start">
          <button type="button" class="demo-start-button" @click="runDemoDraw">抽選開始</button>
          <p class="demo-hint">抽選ボタンを押すと1回だけデモ抽選を実施します</p>
          <p v-if="errorMessage" class="demo-error">{{ errorMessage }}</p>
        </div>

        <div v-else-if="!result" class="demo-drawing">
          <span class="demo-drawing-spinner"></span>
          <p>抽選中...</p>
        </div>

        <transition name="demo-fade">
          <div v-if="drawn && result" class="demo-result">
            <p class="demo-result-label">当選者</p>
            <h3 class="demo-result-member">{{ result.member }}</h3>
            <p class="demo-result-label">賞品</p>
            <p class="demo-result-prize">{{ result.prize }}</p>
            <p class="demo-next-hint">では本番です！！（Enterキーで本抽選へ）</p>
          </div>
        </transition>
      </div>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import Loader from '../common/loader.vue';
import { useRouter } from 'vue-router';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { container } from 'tsyringe';
import { PrizeRepository } from '@model/prize/prize-repository';
import { MemberRepository } from '@model/member/member-repository';
import { DrawApplicationService } from '@control/draw/draw-application-service';
import { AssetDataService } from '@control/asset/asset-data-service';
import { DemoScreenSetting } from '@model/screen-config/demo-screen-setting';
import { useRemoteScreenSync } from '../../composables/use-remote-screen-sync';
export default {
  name: 'DemoDraw',
  components: { MainLayout, Loader },
  setup() {
    useRemoteScreenSync();
    const router = useRouter();

    const demoConfig = ref<DemoScreenSetting | null>(null);
    const screenSettingsService = container.resolve(ScreenSettingsService);
    const assetService = container.resolve(AssetDataService);

    const prizes = ref<any[]>([]);
    const members = ref<any[]>([]);
    const prizeRepo = container.resolve(PrizeRepository);
    const memberRepo = container.resolve(MemberRepository);
    const fetchPrizes = async () => { prizes.value = await prizeRepo.getPrizes(); };
    const fetchMembers = async () => { members.value = await memberRepo.getMembers(); };

    const bgmAudio = ref<HTMLAudioElement | null>(null);
    let bgmObjectUrl: string | undefined;
    const playBGM = async () => {
      if (!demoConfig.value || !demoConfig.value.demoBgm) return;
      const asset = await assetService.getAssetDataById(demoConfig.value.demoBgm);
      if (asset && (asset as any).blob) {
        try {
          bgmObjectUrl = URL.createObjectURL((asset as any).blob);
          bgmAudio.value = new Audio(bgmObjectUrl);
          bgmAudio.value.loop = true;
          bgmAudio.value.play().catch(() => { });
        } catch (err) { console.error(err); }
      }
    };

    onMounted(async () => {
      const config = await screenSettingsService.fetchScreenSetting('demo', 'demo-screen-settings');
      demoConfig.value = (config as DemoScreenSetting) ?? new DemoScreenSetting("", "", "");
      await playBGM();
      await fetchPrizes();
      await fetchMembers();
    });

    const playSE = async (se: string) => {
      if (!demoConfig.value) return;
      let assetId: string | undefined;
      if (se === 'draw') {
        assetId = demoConfig.value.demoSe1;
      }
      if (!assetId) return;
      const asset = await assetService.getAssetDataById(assetId);
      if (asset && (asset as any).blob) {
        let tempUrl: string | undefined;
        try {
          tempUrl = URL.createObjectURL((asset as any).blob);
          const seAudio = new Audio(tempUrl);
          seAudio.play().catch(() => { });
          if (tempUrl) {
            const urlToRevoke = tempUrl;
            setTimeout(() => { try { URL.revokeObjectURL(urlToRevoke); } catch (e) { } }, 2000);
          }
        } catch (err) { console.error(err); }
      }
    };

    const drawn = ref(false);
    const result = ref<{ member: string; prize: string } | null>(null);
    const errorMessage = ref<string | null>(null);
    const runDemoDraw = async () => {
      if (drawn.value) return;
      playSE('draw');
      drawn.value = true;
      errorMessage.value = null;

      try {
        await fetchPrizes();
        await fetchMembers();
        const drawService = container.resolve(DrawApplicationService);
        // previewDrawは景品在庫・メンバー・抽選結果・抽選状態を一切永続化しないため、
        // デモを何度実行しても本番の抽選データは汚染されない。
        await drawService.initializeStateIfNeeded(prizes.value);
        const { result: drawResult } = await drawService.previewDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
        if (drawResult && drawResult.wonMember) {
          const prizeText = drawResult.wonPrize ? (drawResult.wonPrize.name || drawResult.wonPrize.id) : '';
          result.value = { member: drawResult.wonMember.name || drawResult.wonMember.id, prize: prizeText };
        }
      } catch (err) {
        console.error('Demo draw failed:', err);
        drawn.value = false;
        errorMessage.value = 'デモ抽選に失敗しました。もう一度お試しください。';
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && drawn.value) {
        router.push('/main-draw');
      }
    };
    onMounted(() => window.addEventListener('keydown', handleKey));
    onUnmounted(() => {
      window.removeEventListener('keydown', handleKey);
      if (bgmAudio.value) {
        try { bgmAudio.value.pause(); } catch (e) { }
        bgmAudio.value = null;
      }
      if (bgmObjectUrl) {
        try { URL.revokeObjectURL(bgmObjectUrl); } catch (e) { }
        bgmObjectUrl = undefined;
      }
    });

    return { demoConfig, runDemoDraw, drawn, result, errorMessage };
  },
};
</script>

<style scoped>
.demo-root {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  background: radial-gradient(circle at 50% 30%, #1b0b05 0%, #0b0503 35%, #040203 100%);
}

.demo-card {
  width: min(520px, 92vw);
  text-align: center;
  padding: 40px 32px;
  border-radius: 20px;
  background: rgba(20, 12, 8, 0.72);
  border: 1px solid rgba(255, 211, 111, 0.25);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(255, 122, 160, 0.08);
}

.demo-title {
  margin: 0 0 28px;
  font-size: clamp(22px, 4vw, 30px);
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #fff0d9;
  text-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
}

.demo-start-button {
  padding: 14px 36px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(90deg, #ffd26f, #ff7a7a);
  color: #221208;
  font-weight: 800;
  font-size: 1.05rem;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(255, 122, 122, 0.22);
  transition: transform 160ms ease;
}

.demo-start-button:hover {
  transform: scale(1.04);
}

.demo-hint {
  margin-top: 16px;
  color: rgba(255, 240, 217, 0.75);
  font-size: 0.95rem;
}

.demo-error {
  margin-top: 16px;
  color: #ff8a8a;
  font-weight: 700;
}

.demo-drawing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: rgba(255, 240, 217, 0.85);
  font-weight: 700;
}

.demo-drawing-spinner {
  width: 36px;
  height: 36px;
  border: 4px solid rgba(255, 240, 217, 0.2);
  border-top: 4px solid #ffd36f;
  border-radius: 50%;
  animation: demo-drawing-spin 0.9s linear infinite;
}

@keyframes demo-drawing-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.demo-result-label {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: rgba(255, 220, 190, 0.7);
}

.demo-result-member {
  margin: 4px 0 18px;
  font-size: clamp(24px, 5vw, 34px);
  font-weight: 800;
  background: linear-gradient(90deg, #ffd36f, #ff7aa0);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.demo-result-prize {
  margin: 4px 0 20px;
  font-size: 1.15rem;
  color: #fff0d9;
  font-weight: 600;
}

.demo-next-hint {
  margin-top: 12px;
  color: #9dffb0;
  font-weight: 700;
}

.demo-fade-enter-active {
  transition: opacity 320ms ease, transform 320ms ease;
}

.demo-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
</style>
