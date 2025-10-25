<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">本抽選画面</h2>
      <div v-if="phase === 'idle'">
        <div class="member-box mb-4">
          <MemberDrawAnimation ref="memberAnimRef" :members="members" />
        </div>
        <button @click="startMemberDraw"
          class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">抽選開始</button>
        <p class="mt-4 text-gray-700">Enterキーでも抽選開始できます</p>
      </div>
      <div v-else>
        <div class="roulette-area mb-4">
          <RouletteAnimation ref="rouletteRef" :prizes="prizes" />
        </div>
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
import MemberDrawAnimation from './MemberDrawAnimation.vue';
import RouletteAnimation from './RouletteAnimation.vue';
import { useRouter } from 'vue-router';
import { ScreenSettingsService } from '../../../model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';
import { DrawService } from '../../../model/applications/draw/draw-service';
import { MainScreenSetting } from '../../../model/domains/screen-config/main-screen-setting';
export default {
  name: 'MainDraw',
  components: { MainLayout, MemberDrawAnimation, RouletteAnimation },
  setup() {
    const router = useRouter();

    const mainConfig = ref<MainScreenSetting | null>(null);
    const screenSettingsService = container.resolve(ScreenSettingsService);
    const assetService = container.resolve(AssetDataService);
    onMounted(async () => {
      const config = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
      mainConfig.value = (config as MainScreenSetting) ?? new MainScreenSetting([], 1);
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

    // sound effects placeholder (not used yet)

    const currentMember = ref<any>(null);

    const phase = ref<'idle' | 'memberRunning' | 'memberStopped' | 'prizeRunning' | 'prizeStopped'>('idle');
    const result = ref<{ member: string; prize: string } | null>(null);
    const showHalfModal = ref(false);
    const drawAppService = container.resolve(DrawService);
    const memberAnimRef = ref<any>(null);
    const rouletteRef = ref<any>(null);

    // start member draw: request candidates and begin animation
    const startMemberDraw = async () => {
      if (phase.value !== 'idle') return;
      if (prizes.value.length === 0 || members.value.length === 0) return;
      // ask application for member draw (returns winnerId and dummyIds)
      const memberRes = await drawAppService.executeMemberDraw({ requestCount: 10 });
      // start animation
      memberAnimRef.value?.start?.();
      // store planned winner id for stopping
      (memberAnimRef.value as any).__plannedWinner = memberRes.winnerId;
      phase.value = 'memberRunning';
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      (async () => {
        // Idle -> start member draw
        if (phase.value === 'idle') {
          await startMemberDraw();
          return;
        }

        // Member running -> stop at planned winner and show modal after 1s
        if (phase.value === 'memberRunning') {
          const planned = (memberAnimRef.value as any).__plannedWinner;
          try {
            const stoppedId = await memberAnimRef.value?.stopAt?.(planned);
            const memberObj = members.value.find((m) => m.id === stoppedId || m.id === planned);
            result.value = { member: memberObj ? memberObj.name : (stoppedId || planned || 'なし'), prize: '' };
            phase.value = 'memberStopped';
          } catch (e) {
            // fallback
            const memberObj = members.value.find((m) => m.id === planned);
            result.value = { member: memberObj ? memberObj.name : (planned || 'なし'), prize: '' };
            phase.value = 'memberStopped';
          }
          return;
        }

        // Member stopped -> move to prize draw screen and start prize draw
        if (phase.value === 'memberStopped') {
          phase.value = 'prizeRunning';
          const memberId = (memberAnimRef.value as any).__plannedWinner || '';
          const prizeRes = await drawAppService.executePrizeDraw({ memberId, requestCount: 8 });
          if (prizeRes.isKakuhen) {
            // show kakuhen message
            result.value = { member: members.value.find((m) => m.id === memberId)?.name || memberId, prize: '確変発生！' };
            // run roulette auto reroll: use first dummy and first reserved as placeholders
            const dummyId = prizeRes.dummyPrizeIds && prizeRes.dummyPrizeIds.length ? prizeRes.dummyPrizeIds[0] : null;
            const finalReserved = prizeRes.reservedPrizeIds && prizeRes.reservedPrizeIds.length ? prizeRes.reservedPrizeIds[0] : null;
            // await animation completion (runAutoReroll now returns prizeId)
            if (rouletteRef.value?.runAutoReroll) {
              try {
                await rouletteRef.value.runAutoReroll({ dummyPrizeId: dummyId, finalPrizeId: finalReserved, dummyDuration: 2000, finalDuration: 2000 });
              } catch (e) {
                // ignore animation errors and continue
              }
            } else {
              // fallback wait
              await new Promise(r => setTimeout(r, 2800));
            }
            // assign reserved prize (application logic)
            const assignRes = await drawAppService.executeKakuhenAssign(memberId);
            if (assignRes.winnerPrizeId) {
              const prizeObj = await prizeRepo.getPrizeById(assignRes.winnerPrizeId);
              result.value = { member: members.value.find((m) => m.id === memberId)?.name || memberId, prize: prizeObj ? prizeObj.name : assignRes.winnerPrizeId };
              const idx = prizes.value.findIndex((p) => p.id === assignRes.winnerPrizeId);
              if (idx >= 0) prizes.value.splice(idx, 1);
            }
            phase.value = 'prizeStopped';
          } else {
            // normal prize
            if (prizeRes.winnerPrizeId) {
              const prizeObj = await prizeRepo.getPrizeById(prizeRes.winnerPrizeId);
              result.value = { member: members.value.find((m) => m.id === memberId)?.name || memberId, prize: prizeObj ? prizeObj.name : prizeRes.winnerPrizeId };
              const idx = prizes.value.findIndex((p) => p.id === prizeRes.winnerPrizeId);
              if (idx >= 0) prizes.value.splice(idx, 1);
            }
            phase.value = 'prizeStopped';
          }
          return;
        }

        // Prize stopped -> if prizes remain, reset to idle for next member draw; otherwise navigate to result
        if (phase.value === 'prizeStopped') {
          if (prizes.value.length === 0) {
            router.push('/jackpot-result');
          } else {
            // reset
            result.value = null;
            currentMember.value = null;
            phase.value = 'idle';
          }
          return;
        }
      })();
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

    return { mainConfig, startMemberDraw, phase, result, currentMember, prizes, showHalfModal, objectUrlMap, members, memberAnimRef, rouletteRef };
  },
};
</script>
