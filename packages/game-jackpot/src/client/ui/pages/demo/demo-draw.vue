<template>
  <MainLayout>
    <Loader v-if="!demoConfig" label="読み込み中..." />
    <div v-else class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">デモ抽選画面</h2>
      <div v-if="!drawn">
        <button @click="runDemoDraw"
          class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">抽選開始</button>
        <p class="mt-4 text-gray-700">抽選ボタンを押すと1回だけデモ抽選を実施します</p>
        <p v-if="errorMessage" class="mt-4 text-red-600 font-bold">{{ errorMessage }}</p>
      </div>
      <div v-else>
        <transition name="fade">
          <div class="result-box" v-if="result">
            <h3 class="text-xl font-bold text-pink-600 mb-2">当選者: {{ result.member }}</h3>
            <p class="text-lg text-indigo-700">賞品: {{ result.prize }}</p>
            <p class="mt-4 text-green-700 font-bold">では本番です！！（Enterキーで本抽選へ）</p>
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
