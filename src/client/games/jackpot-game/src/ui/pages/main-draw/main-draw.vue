<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">本抽選画面</h2>
      <div v-if="!drawn">
        <div class="member-box mb-4">
          <img :src="currentMember?.photoAssetId ? objectUrlMap.get(currentMember.photoAssetId) : ''"
            class="w-24 h-24 rounded-full mx-auto mb-2" />
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
import { PrizeRepository } from '../../../model/infrastructures/prize-repository';
import { MemberRepository } from '../../../model/infrastructures/member-repository';
import { container } from 'tsyringe';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import { ScreenSettingsService } from '../../../model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';
import { DrawService } from '../../../model/applications/draw/draw-service';
import { MainScreenSetting } from '../../../model/domains/screen-config/main-screen-setting';
export default {
  name: 'MainDraw',
  components: { MainLayout },
  setup() {
    const router = useRouter();

    const mainConfig = ref<MainScreenSetting | null>(null);
    const screenSettingsService = container.resolve(ScreenSettingsService);
    const assetService = container.resolve(AssetDataService);
    onMounted(async () => {
      const config = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
      mainConfig.value = (config as MainScreenSetting) ?? new MainScreenSetting([], [], 1, []);
      fetchPrizes();
      fetchMembers();
      setTimeout(playBGM, 1200);
    });

    const prizes = ref<any[]>([]);
    const members = ref<any[]>([]);

    const objectUrlMap = new Map<string, string>();
    const prizeRepo = container.resolve(PrizeRepository);
    const memberRepo = container.resolve(MemberRepository);
    const fetchPrizes = async () => {
      prizes.value = await prizeRepo.getPrizes();
    };
    const fetchMembers = async () => {
      members.value = await memberRepo.getMembers();
      for (const m of members.value) {
        if (m.photoAssetId && !objectUrlMap.has(m.photoAssetId)) {
          try {
            const asset = await assetService.getAssetDataById(m.photoAssetId);
            if (asset && asset.id) {
              objectUrlMap.set(m.photoAssetId, URL.createObjectURL(asset.blob));
            }
          } catch { }
        }
      }
    };

    const bgmAudio = ref<HTMLAudioElement | null>(null);
    let bgmObjectUrl: string | undefined;
    const playBGM = async () => {
      if (!mainConfig.value || !mainConfig.value.memberLotteryBgms.length) return;
      const asset = await assetService.getAssetDataById(mainConfig.value.memberLotteryBgms[0]);
      if (asset && asset.blob) {
        try {
          bgmObjectUrl = URL.createObjectURL(asset.blob);
          bgmAudio.value = new Audio(bgmObjectUrl);
          bgmAudio.value.loop = true;
          try { await bgmAudio.value.play(); } catch (e) { }
        } catch (err) { console.error(err); }
      }
    };

    const playSE = async () => {

    };

    const currentMember = ref<any>(null);

    const drawn = ref(false);
    const result = ref<{ member: string; prize: string } | null>(null);
    const showHalfModal = ref(false);
    const drawAppService = container.resolve(DrawService);
    const runMainDraw = async () => {
      if (drawn.value || prizes.value.length === 0 || members.value.length === 0) return;
      playSE();
      drawn.value = true;
      try {
        // 1) member draw
        const memberRes = await drawAppService.executeMemberDraw({ requestCount: 10 });
        if (memberRes.winnerId) {
          const member = members.value.find((m) => m.id === memberRes.winnerId);
          if (member) currentMember.value = member;
        } else {
          currentMember.value = null;
        }

        // show member result modal
        result.value = { member: currentMember.value ? currentMember.value.name || currentMember.value.id : 'なし', prize: '' };
      } finally {

      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (drawn.value && prizes.value.length > 0) {
          // move to prize draw
          (async () => {
            try {
              const drawAppService = container.resolve(DrawService);
              const memberId = currentMember.value ? currentMember.value.id : '';
              const prizeRes = await drawAppService.executePrizeDraw({ memberId, requestCount: 8 });
              if (prizeRes.isKakuhen) {
                // kakuhen sequence: wait 2s then assign reserved prize
                result.value = { member: currentMember.value ? currentMember.value.name : '', prize: '確変発生！' };
                setTimeout(async () => {
                  const assignRes = await drawAppService.executeKakuhenAssign(memberId);
                  if (assignRes.winnerPrizeId) {
                    const prizeObj = await prizeRepo.getPrizeById(assignRes.winnerPrizeId);
                    result.value = { member: currentMember.value ? currentMember.value.name : '', prize: prizeObj ? prizeObj.name : assignRes.winnerPrizeId };
                    // remove prize from UI list
                    const idx = prizes.value.findIndex((p) => p.id === assignRes.winnerPrizeId);
                    if (idx >= 0) prizes.value.splice(idx, 1);
                  }
                }, 2000);
              } else {
                if (prizeRes.winnerPrizeId) {
                  const prizeObj = await prizeRepo.getPrizeById(prizeRes.winnerPrizeId);
                  result.value = { member: currentMember.value ? currentMember.value.name : '', prize: prizeObj ? prizeObj.name : prizeRes.winnerPrizeId };
                  const idx = prizes.value.findIndex((p) => p.id === prizeRes.winnerPrizeId);
                  if (idx >= 0) prizes.value.splice(idx, 1);
                }
              }

              if (prizes.value.length === 0) {
                // finished
              } else if (prizes.value.length === Math.ceil((await prizeRepo.getPrizes()).length / 2)) {
                showHalfModal.value = true;
                setTimeout(() => { showHalfModal.value = false; }, 2000);
              }
            } finally {
              // reset for next member draw
              drawn.value = false;
              // clear currentMember so next Enter starts fresh
              currentMember.value = null;
            }
          })();
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

    return { mainConfig, runMainDraw, drawn, result, currentMember, prizes, showHalfModal, objectUrlMap };
  },
};
</script>
