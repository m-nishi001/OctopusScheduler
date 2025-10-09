<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">デモ抽選画面</h2>
      <div v-if="!drawn">
        <button @click="runDemoDraw"
          class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">抽選開始</button>
        <p class="mt-4 text-gray-700">抽選ボタンを押すと1回だけデモ抽選を実施します</p>
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
import { useRouter } from 'vue-router';
import type { ScreenConfigDto } from '../../../model/applications/screen-config/dto/screen-config-dto';
import { ScreenConfigService } from '../../../model/applications/screen-config/screen-config-service';
import { container } from 'tsyringe';
import { PrizeService } from '../../../model/applications/prize/prize-service';
import { MemberService } from '../../../model/applications/member/member-service';
export default {
  name: 'DemoDraw',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    // ScreenConfigServiceから取得
    const screenConfig = ref<ScreenConfigDto | null>(null);
    const screenConfigService = container.resolve(ScreenConfigService);
    onMounted(async () => {
      screenConfig.value = await screenConfigService.fetchScreenConfig('demo');
      setTimeout(playBGM, 1200);
    });

    // データはモデル層から取得
    const prizes = ref<any[]>([]);
    const members = ref<any[]>([]);
    const drawOrchestrator = container.resolve<any>("DrawOrchestrator");
    const fetchPrizes = async () => { prizes.value = await container.resolve<any>(PrizeService).fetchPrizes(); };
    const fetchMembers = async () => { members.value = await container.resolve<any>(MemberService).fetchMembers(); };

    // BGM/SE制御
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const playBGM = () => {
      if (!screenConfig.value?.bgmAssetUrl) return;
      if (!bgmAudio.value) {
        bgmAudio.value = new Audio(screenConfig.value.bgmAssetUrl);
        bgmAudio.value.loop = true;
      }
      bgmAudio.value.play();
    };
    onMounted(() => {
      setTimeout(playBGM, 1200);
      fetchPrizes();
      fetchMembers();
    });

    const playSE = (se: string) => {
      if (!screenConfig.value?.seAssetUrls) return;
      const assetUrl = screenConfig.value.seAssetUrls.find(url => url.includes(se));
      if (!assetUrl) return;
      const seAudio = new Audio(assetUrl);
      seAudio.play();
    };

    // 抽選ロジック
    const drawn = ref(false);
    const result = ref<{ member: string; prize: string } | null>(null);
    const runDemoDraw = async () => {
      if (drawn.value) return;
      playSE('draw');
      drawn.value = true;
      // perform a lightweight draw using orchestrator with available data
      try {
        // ensure data
        prizes.value = await container.resolve<any>(PrizeService).fetchPrizes();
        members.value = await container.resolve<any>(MemberService).fetchMembers();
        const res = await drawOrchestrator.executeDrawWith({ prizes: prizes.value, members: members.value });
        const resultRes = await drawOrchestrator.fetchResult(res.drawId);
        const winner = resultRes?.results?.[0];
        if (winner) {
          result.value = { member: winner.member.name || winner.member.id, prize: winner.prize.name || winner.prize.id };
        }
      } finally {
        // no-op
      }
    };

    // Enterキーで本抽選へ
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && drawn.value) {
        router.push('/main-draw');
      }
    };
    onMounted(() => window.addEventListener('keydown', handleKey));
    onUnmounted(() => window.removeEventListener('keydown', handleKey));

    return { screenConfig, runDemoDraw, drawn, result };
  },
};
</script>
