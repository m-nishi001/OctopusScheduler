<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">本抽選画面</h2>
      <div v-if="!drawn">
        <div class="member-box mb-4">
          <img :src="currentMember.photoDataUrl" class="w-24 h-24 rounded-full mx-auto mb-2" />
          <div class="text-lg font-bold text-indigo-700">{{ currentMember.name }}</div>
        </div>
        <button @click="runMainDraw"
          class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">抽選開始</button>
        <p class="mt-4 text-gray-700">Enterキーでも抽選開始できます</p>
      </div>
      <div v-else>
        <transition name="fade">
          <div class="result-box" v-if="result">
            <h3 class="text-xl font-bold text-pink-600 mb-2">当選者: {{ result.member }}</h3>
            <p class="text-lg text-indigo-700">賞品: {{ result.prize }}</p>
            <p class="mt-4 text-green-700 font-bold">Enterキーで次の抽選</p>
          </div>
        </transition>
      </div>
      <div v-if="showHalfModal" class="modal">
        <div class="modal-content">残り半分です！</div>
      </div>
      <div v-if="prizes.length === 0" class="modal">
        <div class="modal-content">抽選終了！Enterキーで結果画面へ</div>
      </div>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { PrizeRepository } from '../../../model/infrastructures/repositories/prize-repository';
import { MemberRepository } from '../../../model/infrastructures/repositories/member-repository';
import { container } from 'tsyringe';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import { ScreenConfigService } from '../../../model/applications/screen-config/screen-config-service';
import { DriveDataService } from '../../../model/applications/asset/drive-data-service';
import { DrawRepository } from '../../../model/infrastructures/repositories/draw-repository';
import { DrawResultService } from '../../../model/applications/draw-result/draw-result-service';
import { MainScreenSetting } from '../../../model/domains/screen-config/main-screen-setting';
export default {
  name: 'MainDraw',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    // ScreenConfigRepositoryから取得
    const mainConfig = ref<MainScreenSetting | null>(null);
    const screenConfigService = container.resolve(ScreenConfigService);
    const assetService = container.resolve<DriveDataService>("DriveDataService");
    onMounted(async () => {
      const config = await screenConfigService.fetchScreenConfig('main');
      mainConfig.value = config as MainScreenSetting ?? new MainScreenSetting([], [], 1, []);
      fetchPrizes();
      fetchMembers();
      setTimeout(playBGM, 1200);
    });

    // APIから取得
    const prizes = ref<any[]>([]);
    const members = ref<any[]>([]);
    const prizeRepo = container.resolve(PrizeRepository);
    const memberRepo = container.resolve(MemberRepository);
    const fetchPrizes = async () => {
      prizes.value = await prizeRepo.getPrizes();
    };
    const fetchMembers = async () => {
      members.value = await memberRepo.getMembers();
    };

    // BGM/SE制御
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    let bgmObjectUrl: string | undefined;
    const playBGM = async () => {
      if (!mainConfig.value || !mainConfig.value.memberLotteryBgms.length) return;
      const asset = await assetService.getDriveDataById(mainConfig.value.memberLotteryBgms[0]);
      if (asset) {
        let url = (asset as any).dataUrl as string | undefined;
        if (!url && (asset as any).blob) {
          try { bgmObjectUrl = URL.createObjectURL((asset as any).blob); url = bgmObjectUrl; } catch (err) { console.error(err); }
        }
        if (url) {
          bgmAudio.value = new Audio(url);
          bgmAudio.value.loop = true;
          try { await bgmAudio.value.play(); } catch (e) { /* ignore */ }
        }
      }
    };

    const playSE = async () => {
      // SE playback removed as per new config
    };

    // メンバー選出
    const currentMember = ref<any>(null);

    // 抽選ロジック (モデル層へ委譲)
    const drawn = ref(false);
    const result = ref<{ member: string; prize: string } | null>(null);
    const showHalfModal = ref(false);
    const runMainDraw = async () => {
      if (drawn.value || prizes.value.length === 0 || members.value.length === 0) return;
      playSE();
      drawn.value = true;
      try {
        const drawRepo = container.resolve(DrawRepository);
        const drawResultService = container.resolve(DrawResultService);
        const res = await drawRepo.executeDraw({ prizes: prizes.value, members: members.value });
        const resultRes = await drawResultService.getDrawResultById(res.drawId);
        const winner = resultRes;
        if (winner) {
          currentMember.value = winner.member;
          result.value = { member: winner.member.name || winner.member.id, prize: winner.prize.name || winner.prize.id };
        }
        if (result.value && result.value.prize) {
          const idx = prizes.value.findIndex((p) => (p.id ? p.id === result.value!.prize : p.name === result.value!.prize));
          if (idx >= 0) prizes.value.splice(idx, 1);
        }
        if (prizes.value.length === 3) {
          showHalfModal.value = true;
          setTimeout(() => { showHalfModal.value = false; }, 2000);
        }
      } finally {
        // keep drawn true until user proceeds
      }
    };

    // Enterキーで次の抽選 or 結果画面へ
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (drawn.value && prizes.value.length > 0) {
          // 次の抽選
          drawn.value = false;
          result.value = null;
          currentMember.value = null;
        } else if (prizes.value.length === 0) {
          router.push('/jackpot-result');
        }
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

    return { mainConfig, runMainDraw, drawn, result, currentMember, prizes, showHalfModal };
  },
};
</script>
