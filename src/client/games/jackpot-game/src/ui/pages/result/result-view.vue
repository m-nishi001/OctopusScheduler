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
      <p class="mt-4 text-green-700 font-bold">Enterキーでエンディング画面へ</p>
    </div>
    <transition name="fade-black">
      <div v-if="fadeOut" class="fade-black"></div>
    </transition>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { DrawResultService } from '@model/applications/draw/draw-result-service';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { ResultScreenSetting } from '@model/domains/screen-config/result-screen-setting';

export default {
  name: 'ResultView',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    const winners = ref<any[]>([]);
    const specialWinner = ref<any | undefined>(undefined);
    const lowestWinner = ref<any | undefined>(undefined);
    const resultConfig = ref<ResultScreenSetting | null>(null);

    const objectUrlMap = new Map<string, string>();

    const screenSettingsService = container.resolve(ScreenSettingsService);
    const assetService = container.resolve(AssetDataService);
    const drawResultService = container.resolve(DrawResultService);
    const fetchResults = async () => {
      const results = await drawResultService.getDrawResults();
      const config = await screenSettingsService.fetchScreenSetting('result', 'result-screen-settings');
      resultConfig.value = (config as ResultScreenSetting) ?? new ResultScreenSetting("", "", "");

      for (const r of results) {
        if (r.member) {
          const aid = r.member.photoAssetId;
          if (aid) {
            const asset = await assetService.getAssetDataById(aid);
            if (asset && asset.id && !objectUrlMap.has(asset.id)) {
              try { objectUrlMap.set(asset.id, URL.createObjectURL(asset.blob)); } catch { }
            }
          }
        }
      }
      winners.value = results.filter(r => r.member).map(r => ({ ...r.member!, prize: r.prize ? r.prize.name : '', id: r.member!.id, photo: (r.member!.photoAssetId ? objectUrlMap.get(r.member!.photoAssetId) : undefined) || r.member!.photoAssetId }));
      const ranks = results.filter(r => r.member).map(r => r.memberRank || 0);
      const minRank = Math.min(...ranks);
      const maxRank = Math.max(...ranks);
      specialWinner.value = results.find(r => r.member && r.memberRank === minRank)?.member;
      lowestWinner.value = results.find(r => r.member && r.memberRank === maxRank)?.member;
    };
    onMounted(() => {
      fetchResults();
    });

    const bgmAudio = ref<HTMLAudioElement | null>(null);
    let bgmObjectUrl: string | undefined;
    const playBGM = async () => {
      if (!resultConfig.value || !resultConfig.value.resultBgm) return;
      const asset = await assetService.getAssetDataById(resultConfig.value.resultBgm);
      if (asset) {

        if (asset.blob) {
          try { bgmObjectUrl = URL.createObjectURL(asset.blob); }
          catch (err) { console.error(err); bgmObjectUrl = undefined; }
        }
        const url = bgmObjectUrl;
        if (url) {
          bgmAudio.value = new Audio(url);
          bgmAudio.value.loop = true;
          bgmAudio.value.play().catch(() => { });
        }
      }
    };
    onMounted(() => {
      setTimeout(playBGM, 1200);
    });


    const fadeOut = ref(false);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !fadeOut.value) {
        fadeOut.value = true;
        setTimeout(() => {
          router.push('/jackpot-ending');
        }, 1200);
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
  box-shadow: 0 2px 8px rgba(42, 82, 152, 0.08);
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
