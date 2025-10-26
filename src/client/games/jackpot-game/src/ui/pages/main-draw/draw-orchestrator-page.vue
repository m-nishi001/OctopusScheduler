<template>
  <MainLayout>
    <div class="orchestrator container mx-auto p-6">
      <h2 class="text-2xl font-bold mb-4">Draw Orchestrator</h2>

      <div class="controls mb-4">
        <button @click="start" class="btn-primary">開始</button>
        <p class="mt-2 text-sm text-gray-600">mode: {{ mode }}</p>
      </div>

      <div v-if="mode === 'rich'">
        <div class="member-area mb-4">
          <MemberDrawAnimation ref="memberAnimRef" :members="members" />
        </div>
        <div class="roulette-area">
          <RouletteAnimation ref="rouletteRef" :prizes="prizes" />
        </div>
      </div>

      <div v-else>
        <div class="simple-area bg-white/80 rounded p-4">
          <h3 class="font-semibold">簡易抽選モード</h3>
          <p v-if="latestResult">当選: {{ latestResult.member }} — 賞品: {{ latestResult.prize }}</p>
        </div>
      </div>
    </div>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import MemberDrawAnimation from './MemberDrawAnimation.vue';
import RouletteAnimation from './RouletteAnimation.vue';
import { usePrizesAndMembers } from '../../composables/usePrizesAndMembers';
import { waitForEnter } from '../../composables/useEnterKey';
import DrawAdapter from '../../../model/adapters/draw-adapter';

export default {
  name: 'DrawOrchestratorPage',
  components: { MainLayout, MemberDrawAnimation, RouletteAnimation },
  props: {
    mode: { type: String as () => 'simple' | 'rich', default: 'rich' }
  },
  setup(props: any) {
    const { prizes, members, fetchPrizes, fetchMembers } = usePrizesAndMembers();
    const latestResult = ref<any | null>(null);
    const memberAnimRef = ref<any>(null);
    const rouletteRef = ref<any>(null);

    onMounted(async () => {
      await fetchPrizes();
      await fetchMembers();
    });

    const start = async () => {
      if (props.mode === 'simple') {
        // simple: call a single full draw and display result (press Enter to continue)
        const res = await DrawAdapter.executeFullDraw();
        // adapter may return different shapes; be defensive
        latestResult.value = (res && res.member) ? res : { member: res?.member || 'unknown', prize: res?.prize || 'unknown' };
        try {
          await waitForEnter();
        } catch (e) { }
        // navigation or next step can be handled by caller
        return;
      }

      // rich mode: do member draw then prize draw using adapter and child animations when available
      try {
        const memberRes = await DrawAdapter.executeMemberDraw({ requestCount: 10 });
        const plannedId = memberRes?.winnerId || memberRes?.winner || null;
        // start member animation if present
        if (memberAnimRef.value?.start) memberAnimRef.value.start();
        // store planned id on the child so stopAt can use it (existing components expect this)
        if (memberAnimRef.value) (memberAnimRef.value as any).__plannedWinner = plannedId;

        // wait for Enter to stop member animation
        await waitForEnter();
        if (memberAnimRef.value?.stopAt) {
          try {
            const stopped = await memberAnimRef.value.stopAt(plannedId);
            latestResult.value = { member: members.value.find((m: any) => m.id === stopped)?.name || stopped, prize: '' };
          } catch (e) {
            latestResult.value = { member: plannedId || 'unknown', prize: '' };
          }
        } else {
          latestResult.value = { member: plannedId || 'unknown', prize: '' };
        }

        // wait for Enter to proceed to prize draw
        await waitForEnter();
        const prizeRes = await DrawAdapter.executePrizeDraw({ memberId: plannedId, requestCount: 8 });
        const prizeId = prizeRes?.winnerPrizeId || prizeRes?.prizeId || null;
        if (prizeId) {
          // tell roulette to run to prize if supported
          if (rouletteRef.value?.runTo) {
            try { await rouletteRef.value.runTo(prizeId); } catch (e) { }
          }
          latestResult.value.prize = prizeId;
        }

        // final Enter to finish
        await waitForEnter();
      } catch (e) {
        // fallback: display error briefly
        latestResult.value = { member: 'error', prize: '' };
      }
    };

    return { prizes, members, latestResult, start, memberAnimRef, rouletteRef };
  }
};
</script>

<style scoped>
.orchestrator { max-width: 1024px; }
.btn-primary { background: linear-gradient(90deg,#6d28d9,#ec4899); color: white; padding: 8px 14px; border-radius: 6px; }
</style>
