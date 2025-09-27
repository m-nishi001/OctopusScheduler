<template>
  <MainLayout>
    <div v-if="!fadeOut" class="result-content">
      <h2 class="jp-title">抽選結果</h2>
      <ul class="jp-winner-list">
        <li v-for="winner in winners" :key="winner.id" :class="winnerClass(winner)">
          <img :src="winner.photo" class="w-12 h-12 rounded-full mr-2 align-middle" />
          <span class="winner-name">{{ winner.name }}</span>
          <span class="winner-prize">（{{ winner.prize }}）</span>
        </li>
      </ul>
      <div v-if="specialWinner" class="special-winner">最高ランク当選者: {{ specialWinner?.name }}</div>
      <div v-if="lowestWinner" class="lowest-winner">最低ランク当選者: {{ lowestWinner?.name }}</div>
      <p class="mt-4 text-green-700 font-bold">Enterキーでホーム画面へ</p>
    </div>
    <transition name="fade-black">
      <div v-if="fadeOut" class="fade-black"></div>
    </transition>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ResultService } from '../../../model/applications/ResultService';
import MainLayout from '../common/MainLayout.vue';
import { useRouter } from 'vue-router';

export default {
  name: 'ResultView',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    // APIから取得
    const resultService = new ResultService();
    const winners = ref<any[]>([]);
    const fetchResults = async () => {
      // 仮のdrawId（本来は画面遷移やstateから取得）
      const drawId = 'main';
      const response = await resultService.getResult(drawId);
      // APIのresultsをwinners形式に変換（必要に応じて）
      winners.value = response.results.map((r: any, idx: number) => ({
        id: idx + 1,
        name: r.memberName || r.memberId,
        photo: r.photoAssetId || '/assets/img/member1.png',
        prize: r.prizeName || r.prizeId,
        rank: r.rank || 1
      }));
    };
    onMounted(() => {
      fetchResults();
    });

    // BGM/SE制御
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const playBGM = () => {
      if (!bgmAudio.value) {
        bgmAudio.value = new Audio('/assets/bgm/result_bgm.mp3');
        bgmAudio.value.loop = true;
      }
      bgmAudio.value.play();
    };
    onMounted(() => {
      setTimeout(playBGM, 1200);
    });

    // 最高/最低ランク当選者
    const specialWinner = ref<typeof winners.value[0] | undefined>(undefined);
    const lowestWinner = ref<typeof winners.value[0] | undefined>(undefined);
    onMounted(() => {
      let maxRank = Math.min(...winners.value.map(w => w.rank));
      let minRank = Math.max(...winners.value.map(w => w.rank));
      specialWinner.value = winners.value.find(w => w.rank === maxRank);
      lowestWinner.value = winners.value.find(w => w.rank === minRank);
    });

    // フェードイン・Enterキーでホームへ
    const fadeOut = ref(false);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !fadeOut.value) {
        fadeOut.value = true;
        setTimeout(() => {
          router.push('/');
        }, 1200);
      }
    };
    onMounted(() => window.addEventListener('keydown', handleKey));
    onUnmounted(() => window.removeEventListener('keydown', handleKey));

    // 特別演出用クラス
    const winnerClass = (winner: any) => {
      if (specialWinner.value && winner.id === specialWinner.value.id) return 'jp-winner-item special';
      if (lowestWinner.value && winner.id === lowestWinner.value.id) return 'jp-winner-item lowest';
      return 'jp-winner-item';
    };

    return { winners, specialWinner, lowestWinner, fadeOut, winnerClass };
  },
};
</script>

<style scoped>
.jp-title {
  font-size: 2.2em;
  color: #fff;
  text-shadow: 0 2px 12px #2a5298;
  margin-bottom: 32px;
  font-family: 'Orbitron', 'Montserrat', sans-serif;
}
.jp-winner-list {
  list-style: none;
  padding: 0;
  margin-bottom: 24px;
  max-height: 220px;
  overflow-y: auto;
}
.jp-winner-item {
  background: linear-gradient(90deg, #e3eafc 0%, #fff 100%);
  color: #2a5298;
  font-size: 1.1em;
  font-family: 'Montserrat', sans-serif;
  margin: 8px 0;
  padding: 10px 18px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(42,82,152,0.08);
  display: flex;
  align-items: center;
}
.special {
  background: linear-gradient(90deg, #f9a8d4 0%, #fef08a 100%);
  color: #d946ef;
  font-weight: bold;
  border: 2px solid #f9a8d4;
}
.lowest {
  background: linear-gradient(90deg, #a5b4fc 0%, #e0e7ff 100%);
  color: #6366f1;
  font-weight: bold;
  border: 2px solid #a5b4fc;
}
.winner-name {
  margin-left: 8px;
  font-size: 1.1em;
}
.winner-prize {
  margin-left: 8px;
  font-size: 1em;
  color: #64748b;
}
.special-winner {
  margin-top: 12px;
  color: #d946ef;
  font-weight: bold;
}
.lowest-winner {
  margin-top: 8px;
  color: #6366f1;
  font-weight: bold;
}
.fade-black {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #000;
  opacity: 0.85;
  z-index: 9999;
  transition: opacity 1.2s;
}
.result-content {
  transition: opacity 1.2s;
}
.fade-black-enter-active, .fade-black-leave-active {
  transition: opacity 1.2s;
}
.fade-black-enter-from, .fade-black-leave-to {
  opacity: 0;
}
.fade-black-enter-to, .fade-black-leave-from {
  opacity: 0.85;
}
</style>
