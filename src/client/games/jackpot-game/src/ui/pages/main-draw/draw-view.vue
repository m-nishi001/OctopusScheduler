<template>
  <MainLayout>
    <h2 class="jp-title">抽選実行</h2>
    <Button @click="executeDraw" :disabled="loading || currentStep !== 'idle'">抽選開始</Button>
    <Loader v-if="loading" />
    <div v-if="currentStep === 'member'" class="selection-area">
      <h3>メンバー選出</h3>
      <div class="member-display" ref="memberDisplay">{{ selectedMember?.name }}</div>
      <p>Enterキーで景品抽選へ</p>
    </div>
    <div v-if="currentStep === 'prize'" class="selection-area">
      <h3>景品抽選</h3>
      <div class="prize-display" ref="prizeDisplay">{{ selectedPrize?.name }}</div>
      <p>Enterキーで次へ</p>
    </div>
    <div v-if="currentStep === 'finished'" class="finished-area">
      <h3>抽選終了</h3>
      <Button @click="goResult">結果画面へ</Button>
    </div>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import Button from '../common/button.vue';
import Loader from '../common/loader.vue';
import type { MemberDto } from '../../../model/applications/member/dto/member-dto';
import type { PrizeDto } from '../../../model/applications/prize/dto/prize-dto';
import type { DrawResultDto } from '../../../model/applications/draw-result/dto/draw-result-dto';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import gsap from 'gsap';
import { DrawRepository } from '../../../model/infrastructures/draw-repository';
import { DrawResultService } from '../../../model/applications/draw-result/draw-result-service';
import { PrizeRepository } from '../../../model/infrastructures/prize-repository';
import { MemberRepository } from '../../../model/infrastructures/member-repository';

export default {
  name: 'DrawView',
  components: { MainLayout, Button, Loader },
  setup() {
    const loading = ref(false);
    const currentStep = ref<'idle' | 'member' | 'prize' | 'finished'>('idle');
    const selectedMember = ref<MemberDto | null>(null);
    const selectedPrize = ref<PrizeDto | null>(null);
    const results = ref<DrawResultDto[]>([]);
    const router = useRouter();
    const drawRepo = container.resolve(DrawRepository);
    const drawResultService = container.resolve(DrawResultService);
    const prizeRepo = container.resolve(PrizeRepository);
    const memberRepo = container.resolve(MemberRepository);
    const prizes = ref<PrizeDto[]>([]);
    const members = ref<MemberDto[]>([]);
    const memberDisplay = ref<HTMLElement | null>(null);
    const prizeDisplay = ref<HTMLElement | null>(null);

    onMounted(async () => {
      prizes.value = await prizeRepo.getPrizes();
      members.value = await memberRepo.getMembers();
    });

    const executeDraw = async () => {
      loading.value = true;
      try {
        const drawRes = await drawRepo.executeDraw({
          prizes: prizes.value,
          members: members.value,
        });
        const resultRes = await drawResultService.getDrawResultById(drawRes.drawId);
        results.value = resultRes ? [resultRes] : [];

        for (const result of results.value) {

          currentStep.value = 'member';
          selectedMember.value = result.member;
          if (memberDisplay.value) {
            gsap.fromTo(memberDisplay.value, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 });
          }
          await waitForEnter();

          currentStep.value = 'prize';
          selectedPrize.value = result.prize;
          if (prizeDisplay.value) {
            gsap.fromTo(prizeDisplay.value, { rotation: 0, opacity: 0 }, { rotation: 360, opacity: 1, duration: 1, ease: 'power2.out' });
          }
          await waitForEnter();
        }

        currentStep.value = 'finished';
      } finally {
        loading.value = false;
      }
    };

    const waitForEnter = () => {
      return new Promise<void>((resolve) => {
        const handler = (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            document.removeEventListener('keydown', handler);
            resolve();
          }
        };
        document.addEventListener('keydown', handler);
      });
    };

    const goResult = () => router.push('/jackpot-result');

    return { loading, currentStep, selectedMember, selectedPrize, executeDraw, goResult, memberDisplay, prizeDisplay };
  },
};
</script>

<style scoped>
  .jp-title {
    font-size: 2.2em;
    color: #ffffff;
    text-shadow: 0 2px 12px #87ceeb;
    margin-bottom: 32px;
    font-family: 'Orbitron', 'Montserrat', sans-serif;
  }

  .selection-area {
    margin-top: 32px;
    text-align: center;
  }

  .member-display,
  .prize-display {
    font-size: 2em;
    color: #ffffff;
    margin: 20px 0;
    padding: 20px;
    background: linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%);
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .finished-area {
    margin-top: 32px;
    text-align: center;
  }
</style>
