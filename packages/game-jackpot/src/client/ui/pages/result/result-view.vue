<template>
  <MainLayout>
    <Loader v-if="isLoading" label="読み込み中..." />
    <div v-if="!isLoading && !fadeOut" class="result-content jp-stage" data-testid="result-screen">
      <div class="jp-rays" aria-hidden="true"></div>
      <h2 class="result-title jp-gold-text">抽選結果</h2>
      <p v-if="winners.length === 0" class="result-empty" data-testid="result-empty">まだ当選者はいません</p>
      <ul v-else class="jp-winner-list" data-testid="result-list">
        <li v-for="winner in winners" :key="winner.id" :class="winnerClass(winner)">
          <img v-if="winner.photo" :src="winner.photo" class="winner-photo" alt="" />
          <span v-else class="winner-photo winner-initial" aria-hidden="true">{{ initialOf(winner.name) }}</span>
          <span class="winner-text">
            <span class="winner-name">{{ winner.name }}</span>
            <span v-if="winner.prize" class="winner-prize">{{ winner.prize }}</span>
          </span>
        </li>
      </ul>
      <div v-if="specialWinner || lowestWinner" class="result-notes">
        <span v-if="specialWinner" class="special-winner">最高ランク当選者: {{ specialWinner?.name }}</span>
        <span v-if="lowestWinner" class="lowest-winner">最低ランク当選者: {{ lowestWinner?.name }}</span>
      </div>
      <p class="result-hint">Enterキーでエンディング画面へ</p>
    </div>
    <transition name="fade-black">
      <div v-if="fadeOut" class="fade-black"></div>
    </transition>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { DrawStoreProvider } from '@control/draw/draw-store-provider';
import MainLayout from '../common/main-layout.vue';
import Loader from '../common/loader.vue';
import { useRouter } from 'vue-router';
import { useJackpotSession } from '../../composables/use-jackpot-session';
import { useJackpotFinale } from '../../composables/use-jackpot-finale';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { AssetDataService } from '@control/asset/asset-data-service';
import { ResultScreenSetting } from '@model/screen-config/result-screen-setting';
import { useScreenBgm } from '../../composables/use-screen-media';
import '../../theme/jackpot-theme.css';

export default {
  name: 'ResultView',
  components: { MainLayout, Loader },
  setup() {
    const router = useRouter();
    const session = useJackpotSession();
    useJackpotFinale();
    const isLoading = ref(true);
    const winners = ref<any[]>([]);
    const specialWinner = ref<any | undefined>(undefined);
    const lowestWinner = ref<any | undefined>(undefined);
    const resultConfig = ref<ResultScreenSetting | null>(null);

    // 当選者の写真の表示用URL（画面を離れたら破棄する）
    const objectUrlMap = new Map<string, string>();
    const bgm = useScreenBgm();
    /** 画面が出てから BGM を鳴らし始めるまでの待ち（ミリ秒）。 */
    const BGM_DELAY_MS = 1200;

    const screenSettingsService = container.resolve(ScreenSettingsService);
    const assetService = container.resolve(AssetDataService);
    const drawStores = container.resolve(DrawStoreProvider);
    const fetchResults = async () => {
      try {
        const results = await drawStores.current().results();
        const config = await screenSettingsService.fetchScreenSetting('result', 'result-screen-settings');
        resultConfig.value = (config as ResultScreenSetting) ?? new ResultScreenSetting("", "", "");
        void bgm.load(resultConfig.value.resultBgm).then(() => bgm.play(BGM_DELAY_MS));

        for (const r of results) {
          if (r.wonMember) {
            const aid = r.wonMember.photoAssetId;
            if (aid) {
              const asset = await assetService.getAssetDataById(aid);
              if (asset && asset.id && !objectUrlMap.has(asset.id)) {
                try { objectUrlMap.set(asset.id, URL.createObjectURL(asset.blob)); } catch { }
              }
            }
          }
        }
        winners.value = results.filter(r => r.wonMember).map(r => ({ ...r.wonMember!, prize: r.wonPrize ? r.wonPrize.name : '', id: r.wonMember!.id, photo: r.wonMember!.photoAssetId ? objectUrlMap.get(r.wonMember!.photoAssetId) : undefined }));
        const ranks = results.filter(r => r.wonMember).map(r => r.wonMember!.rank);
        const minRank = Math.min(...ranks);
        const maxRank = Math.max(...ranks);
        specialWinner.value = results.find(r => r.wonMember && r.wonMember.rank === minRank)?.wonMember;
        lowestWinner.value = results.find(r => r.wonMember && r.wonMember.rank === maxRank)?.wonMember;
      } finally {
        isLoading.value = false;
      }
    };
    onMounted(() => {
      fetchResults();
    });

    const fadeOut = ref(false);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !fadeOut.value) {
        fadeOut.value = true;
        setTimeout(() => {
          router.push(session.to('/jackpot-ending'));
        }, 1200);
      }
    };
    onMounted(() => window.addEventListener('keydown', handleKey));
    onUnmounted(() => {
      window.removeEventListener('keydown', handleKey);
      for (const url of objectUrlMap.values()) {
        try { URL.revokeObjectURL(url); } catch { /* 破棄できなくても画面は閉じる */ }
      }
      objectUrlMap.clear();
    });

    const winnerClass = (winner: any) => {
      if (specialWinner.value && winner.id === specialWinner.value.id) return 'jp-winner-item special';
      if (lowestWinner.value && winner.id === lowestWinner.value.id) return 'jp-winner-item lowest';
      return 'jp-winner-item';
    };

    const initialOf = (name: string) => Array.from(name ?? '')[0] ?? '?';

    return { isLoading, winners, specialWinner, lowestWinner, fadeOut, winnerClass, initialOf };
  },
};
</script>

<style scoped>
.result-content {
  position: relative;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32px 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  transition: opacity 1.2s;
}

.result-content>*:not(.jp-rays) {
  position: relative;
  z-index: 1;
}

.result-title {
  margin: 0 0 24px;
  font-size: clamp(2.2rem, 5vw, 4rem);
  font-weight: 900;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
}

.result-empty {
  margin: 80px 0;
  color: var(--jp-text);
  font-size: 1.6rem;
  opacity: 0.8;
}

/* 当選者の数が多くても画面いっぱいに並べ、はみ出す分だけ一覧の中でスクロールする */
.jp-winner-list {
  list-style: none;
  padding: 8px;
  margin: 0 0 16px;
  width: 100%;
  max-width: 1600px;
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(100vh - 260px);
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  align-content: start;
}

.jp-winner-item {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 12px 18px;
  border-radius: 16px;
  border: 2px solid rgba(255, 213, 74, 0.55);
  background: linear-gradient(135deg, rgba(110, 10, 26, 0.85), rgba(18, 5, 8, 0.9));
  color: var(--jp-text);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
}

.winner-photo {
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--jp-gold);
}

.winner-initial {
  display: grid;
  place-items: center;
  background: var(--jp-red-deep);
  color: var(--jp-gold-light);
  font-size: 1.5rem;
  font-weight: 900;
}

.winner-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.winner-name {
  font-size: 1.3rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.winner-prize {
  margin-top: 2px;
  color: var(--jp-gold);
  font-size: 1.05rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

/* 最高ランク / 最低ランクの当選者は金・銀で目立たせる */
.special {
  border-color: var(--jp-gold);
  box-shadow: var(--jp-glow);
}

.lowest {
  border-color: #cfd8e3;
}

.result-notes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 32px;
  margin-bottom: 8px;
  font-weight: 800;
}

.special-winner {
  color: var(--jp-gold);
}

.lowest-winner {
  color: #cfd8e3;
}

.result-hint {
  margin: 8px 0 0;
  color: var(--jp-gold-light);
  opacity: 0.8;
  font-weight: 700;
}

.fade-black {
  position: fixed;
  inset: 0;
  background: #000;
  opacity: 0.85;
  z-index: 9999;
  transition: opacity 1.2s;
}

.fade-black-enter-active,
.fade-black-leave-active {
  transition: opacity 1.2s;
}

.fade-black-enter-from,
.fade-black-leave-to {
  opacity: 0;
}

.fade-black-enter-to,
.fade-black-leave-from {
  opacity: 0.85;
}
</style>
