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
import { ScreenConfigService } from '../../../model/applications/screen-config/screen-config-service';
import { container } from 'tsyringe';
import { PrizeRepository } from '../../../model/infrastructures/repositories/prize-repository';
import { MemberRepository } from '../../../model/infrastructures/repositories/member-repository';
import { DrawRepository } from '../../../model/infrastructures/repositories/draw-repository';
import { DrawResultService } from '../../../model/applications/draw-result/draw-result-service';
import { AssetService } from '../../../model/applications/asset/asset-service';
import { DemoScreenSetting } from '../../../model/domains/screen-config/demo-screen-setting';
export default {
  name: 'DemoDraw',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    // ScreenConfigRepositoryから取得
    const demoConfig = ref<DemoScreenSetting | null>(null);
    const screenConfigService = container.resolve(ScreenConfigService);
    const assetService = container.resolve(AssetService);

    // データはモデル層から取得
    const prizes = ref<any[]>([]);
    const members = ref<any[]>([]);
    const prizeRepo = container.resolve(PrizeRepository);
    const memberRepo = container.resolve(MemberRepository);
    const fetchPrizes = async () => { prizes.value = await prizeRepo.getPrizes(); };
    const fetchMembers = async () => { members.value = await memberRepo.getMembers(); };

    // BGM/SE制御
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const playBGM = async () => {
      if (!demoConfig.value || !demoConfig.value.demoBgm) return;
      const asset = await assetService.getAssetById(demoConfig.value.demoBgm);
      if (asset && asset.dataUrl) {
        bgmAudio.value = new Audio(asset.dataUrl);
        bgmAudio.value.loop = true;
        bgmAudio.value.play().catch(() => { });
      }
    };

    onMounted(async () => {
      const config = await screenConfigService.fetchScreenConfig('demo');
      demoConfig.value = config as DemoScreenSetting ?? new DemoScreenSetting("", "", "");
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
      const asset = await assetService.getAssetById(assetId);
      if (asset && asset.dataUrl) {
        const seAudio = new Audio(asset.dataUrl);
        seAudio.play().catch(() => { });
      }
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
        await fetchPrizes();
        await fetchMembers();
        const drawRepo = container.resolve(DrawRepository);
        const drawResultService = container.resolve(DrawResultService);
        const res = await drawRepo.executeDraw({ prizes: prizes.value, members: members.value });
        const resultRes = await drawResultService.getDrawResultById(res.drawId);
        const winner = resultRes;
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

    return { demoConfig, runDemoDraw, drawn, result };
  },
};
</script>
