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
import { MEMBER_DRAW_REQUEST_COUNT } from './MemberDrawAnimation.vue';
import { PRIZE_DRAW_REQUEST_COUNT, PRIZE_KAKUHEN_DUMMY_DURATION_MS, PRIZE_KAKUHEN_FINAL_DURATION_MS } from './RouletteAnimation.vue';
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
      mainConfig.value = (config as MainScreenSetting) ?? new MainScreenSetting();
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
      const memberReqCount = typeof MEMBER_DRAW_REQUEST_COUNT !== 'undefined' ? MEMBER_DRAW_REQUEST_COUNT : (mainConfig.value?.memberDrawRequestCount ?? 10);
      const memberRes = await drawAppService.executeMemberDraw({ requestCount: memberReqCount });
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
          const prizeReqCount = typeof PRIZE_DRAW_REQUEST_COUNT !== 'undefined' ? PRIZE_DRAW_REQUEST_COUNT : 8;
          const prizeRes = await drawAppService.executePrizeDraw({ memberId, requestCount: prizeReqCount });
          if (prizeRes.isKakuhen) {
            // show kakuhen message
            result.value = { member: members.value.find((m) => m.id === memberId)?.name || memberId, prize: '確変発生！' };
            // run roulette auto reroll: use first dummy and first reserved as placeholders
            const dummyId = prizeRes.dummyPrizeIds && prizeRes.dummyPrizeIds.length ? prizeRes.dummyPrizeIds[0] : null;
            const finalReserved = prizeRes.reservedPrizeIds && prizeRes.reservedPrizeIds.length ? prizeRes.reservedPrizeIds[0] : null;

            // Prepare and play BGM1 (dummy) and BGM2 (final) based on prize data
            let rerollAudio1: HTMLAudioElement | null = null;
            let rerollAudio2: HTMLAudioElement | null = null;
            let rerollUrl1: string | undefined;
            let rerollUrl2: string | undefined;
            // use per-animation hardcoded durations when available
            const dummyDuration = typeof PRIZE_KAKUHEN_DUMMY_DURATION_MS !== 'undefined' ? PRIZE_KAKUHEN_DUMMY_DURATION_MS : 2000;
            const finalDuration = typeof PRIZE_KAKUHEN_FINAL_DURATION_MS !== 'undefined' ? PRIZE_KAKUHEN_FINAL_DURATION_MS : 2000;
            try {
              // get bgm ids from prize data (if present)
              if (dummyId) {
                const dummyPrize = await prizeRepo.getPrizeById(dummyId);
                const bgmId = dummyPrize?.bgm1AssetId;
                if (bgmId) {
                  const asset = await assetService.getAssetDataById(bgmId);
                  if (asset && asset.blob) {
                    rerollUrl1 = URL.createObjectURL(asset.blob);
                    rerollAudio1 = new Audio(rerollUrl1);
                    try { await rerollAudio1.play(); } catch (e) { /* ignore play error */ }
                  }
                }
              }

              // schedule switching to BGM2 after dummyDuration
              if (finalReserved) {
                const finalPrize = await prizeRepo.getPrizeById(finalReserved);
                const bgm2Id = finalPrize?.bgm2AssetId;
                if (bgm2Id) {
                  const asset2 = await assetService.getAssetDataById(bgm2Id);
                  if (asset2 && asset2.blob) {
                    rerollUrl2 = URL.createObjectURL(asset2.blob);
                    // we will start playback after dummyDuration
                    setTimeout(async () => {
                      try {
                        if (rerollAudio1) {
                          try { rerollAudio1.pause(); } catch (e) { }
                        }
                        rerollAudio2 = new Audio(rerollUrl2);
                        try { await rerollAudio2.play(); } catch (e) { }
                      } catch (e) {
                        /* ignore */
                      }
                    }, dummyDuration);
                  }
                }
              }

              // await animation completion (runAutoReroll now returns prizeId)
              if (rouletteRef.value?.runAutoReroll) {
                try {
                  await rouletteRef.value.runAutoReroll({ dummyPrizeId: dummyId, finalPrizeId: finalReserved, dummyDuration, finalDuration });
                } catch (e) {
                  // ignore animation errors and continue
                }
              } else {
                // fallback wait for both durations
                await new Promise((r) => setTimeout(r, dummyDuration + finalDuration + 200));
              }
            } finally {
              // cleanup audios and object URLs
              try { if (rerollAudio1) { try { (rerollAudio1 as any).pause(); } catch (e) { } rerollAudio1 = null; } } catch (e) { }
              try { if (rerollAudio2) { try { (rerollAudio2 as any).pause(); } catch (e) { } rerollAudio2 = null; } } catch (e) { }
              try { if (rerollUrl1) { URL.revokeObjectURL(rerollUrl1); rerollUrl1 = undefined; } } catch (e) { }
              try { if (rerollUrl2) { URL.revokeObjectURL(rerollUrl2); rerollUrl2 = undefined; } } catch (e) { }
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
          // If a half-modal is currently shown, close it and proceed to reset/routing
          if (showHalfModal.value) {
            showHalfModal.value = false;
            // continue to reset below
            result.value = null;
            currentMember.value = null;
            phase.value = 'idle';
            return;
          }

          // On Enter at prize result, ask application for remaining count and show half/finish modals as needed
          try {
            const last = await drawAppService.getLastPrizeCount();
            if (last.remaining === 0) {
              // finished
              router.push('/jackpot-result');
              return;
            }
            // show half modal when remaining is <= half
            if (last.remaining <= Math.floor(last.total / 2)) {
              showHalfModal.value = true;
              return; // wait for next Enter to actually reset
            }
          } catch (e) {
            // ignore and fallback to normal reset
          }

          // reset to next member draw
          result.value = null;
          currentMember.value = null;
          phase.value = 'idle';
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
