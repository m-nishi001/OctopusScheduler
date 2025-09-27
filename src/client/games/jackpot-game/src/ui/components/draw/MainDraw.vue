<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">本抽選画面</h2>
      <div v-if="!drawn">
        <div class="member-box mb-4">
          <img :src="currentMember.photo" class="w-24 h-24 rounded-full mx-auto mb-2" />
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
import { PrizeService } from '../../../model/applications/PrizeService';
import { MemberService } from '../../../model/applications/MemberService';
import MainLayout from '../common/MainLayout.vue';
import { useRouter } from 'vue-router';
import type { ScreenConfig } from '../../../model/domains/screen-config/ScreenConfig';
import { ScreenConfigService } from '../../../model/applications/ScreenConfigService';
export default {
  name: 'MainDraw',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    // ScreenConfigServiceから取得
    const screenConfig = ref<ScreenConfig | null>(null);
    const screenConfigService = new ScreenConfigService();
    onMounted(async () => {
      screenConfig.value = await screenConfigService.fetchScreenConfig('main');
      fetchPrizes();
      fetchMembers();
      setTimeout(playBGM, 1200);
    });

    // APIから取得
    const prizeService = new PrizeService();
    const memberService = new MemberService();
    const prizes = ref<any[]>([]);
    const members = ref<any[]>([]);
    const fetchPrizes = async () => {
      prizes.value = await prizeService.fetchPrizes();
    };
    const fetchMembers = async () => {
      members.value = await memberService.fetchMembers();
    };

    // BGM/SE制御
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const playBGM = () => {
      if (!bgmAudio.value) {
        bgmAudio.value = new Audio('/assets/bgm/main_bgm.mp3');
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
      const seAudio = new Audio(`/assets/se/${se}.mp3`);
      seAudio.play();
    };

  // メンバー選出
  const currentMember = ref<any>(null);

    // 抽選ロジック
    const drawn = ref(false);
    const result = ref<{ member: string; prize: string } | null>(null);
    const showHalfModal = ref(false);
    const runMainDraw = () => {
      if (drawn.value || prizes.value.length === 0 || members.value.length === 0) return;
      playSE('draw');
      // ランダム賞品選出
      const prizeIdx = Math.floor(Math.random() * prizes.value.length);
      const prize = prizes.value[prizeIdx]?.name || prizes.value[prizeIdx] || '';
      // ランダムメンバー選出
      currentMember.value = members.value[Math.floor(Math.random() * members.value.length)];
      setTimeout(() => {
  result.value = { member: currentMember.value?.name, prize: typeof prize === 'string' ? prize : prize.name };
        drawn.value = true;
        prizes.value.splice(prizeIdx, 1);
        // 残り半分でモーダル表示
        if (prizes.value.length === 3) {
          showHalfModal.value = true;
          setTimeout(() => { showHalfModal.value = false; }, 2000);
        }
      }, 1200);
    };

    // Enterキーで次の抽選 or 結果画面へ
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (drawn.value && prizes.value.length > 0) {
          // 次の抽選
          drawn.value = false;
          result.value = null;
          currentMember.value = members.value[Math.floor(Math.random() * members.value.length)];
        } else if (prizes.value.length === 0) {
          router.push('/result');
        }
      }
    };
    onMounted(() => window.addEventListener('keydown', handleKey));
    onUnmounted(() => window.removeEventListener('keydown', handleKey));

    return { screenConfig, runMainDraw, drawn, result, currentMember, prizes, showHalfModal };
  },
};
</script>
