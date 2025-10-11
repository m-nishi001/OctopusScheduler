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
import type { ScreenConfigDto } from '../../../model/applications/screen-config/dto/screen-config-dto';
import { ScreenConfigRepository } from '../../../model/infrastructures/repositories/screen-config-repository';
import { DrawRepository } from '../../../model/infrastructures/repositories/draw-repository';
import { DrawResultRepository } from '../../../model/infrastructures/repositories/draw-result-repository';
export default {
  name: 'MainDraw',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    // ScreenConfigRepositoryから取得
    const screenConfig = ref<ScreenConfigDto | null>(null);
    const screenConfigRepo = container.resolve(ScreenConfigRepository);
    onMounted(async () => {
      screenConfig.value = await screenConfigRepo.getScreenConfigById('main');
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
    const playBGM = () => {
      if (!screenConfig.value?.bgmAssetUrl) return;
      if (!bgmAudio.value) {
        bgmAudio.value = new Audio(screenConfig.value.bgmAssetUrl);
        bgmAudio.value.loop = true;
      }
      bgmAudio.value.play();
    };
    onMounted(() => {
      fetchPrizes();
      fetchMembers();
      setTimeout(playBGM, 1200);
    });

    const playSE = (se: string) => {
      if (!screenConfig.value?.seAssetUrls) return;
      const assetUrl = screenConfig.value.seAssetUrls.find(url => url.includes(se));
      if (!assetUrl) return;
      const seAudio = new Audio(assetUrl);
      seAudio.play();
    };

    // メンバー選出
    const currentMember = ref<any>(null);

    // 抽選ロジック (モデル層へ委譲)
    const drawn = ref(false);
    const result = ref<{ member: string; prize: string } | null>(null);
    const showHalfModal = ref(false);
    const runMainDraw = async () => {
      if (drawn.value || prizes.value.length === 0 || members.value.length === 0) return;
      playSE('draw');
      drawn.value = true;
      try {
        const drawRepo = container.resolve(DrawRepository);
        const drawResultRepo = container.resolve(DrawResultRepository);
        const res = await drawRepo.executeDraw({ prizes: prizes.value, members: members.value });
        const resultRes = await drawResultRepo.getDrawResultById(res.drawId);
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
    onUnmounted(() => window.removeEventListener('keydown', handleKey));

    return { screenConfig, runMainDraw, drawn, result, currentMember, prizes, showHalfModal };
  },
};
</script>
