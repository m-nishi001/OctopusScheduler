<template>
  <MainLayout>
    <h2 class="jp-title">抽選実行</h2>
    <Button @click="executeDraw" :disabled="loading">抽選する</Button>
    <Loader v-if="loading" />
    <Modal :visible="showResult" @close="showResult = false">
      <h3 class="jp-modal-title">抽選結果</h3>
      <ul class="jp-winner-list">
  <li v-for="winner in winners" :key="winner.memberId" class="jp-winner-item">{{ getMemberName(winner.memberId) }}</li>
      </ul>
      <Button @click="goResult">結果画面へ</Button>
    </Modal>
  </MainLayout>
<style scoped>
.jp-title {
  font-size: 2.2em;
  color: #fff;
  text-shadow: 0 2px 12px #2a5298;
  margin-bottom: 32px;
  font-family: 'Orbitron', 'Montserrat', sans-serif;
}
.jp-modal-title {
  font-size: 1.5em;
  color: #2a5298;
  margin-bottom: 18px;
  font-family: 'Orbitron', 'Montserrat', sans-serif;
}
.jp-winner-list {
  list-style: none;
  padding: 0;
  margin-bottom: 24px;
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
}
</style>
</template>

<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import Button from '../common/button.vue';
import Loader from '../common/loader.vue';
import Modal from '../common/modal.vue';
import { ref } from 'vue';
import type { LotteryResultDto } from '../../../model/applications/dto/lottery-result-dto';
import type { MemberDto } from '../../../model/applications/dto/member-dto';
import { DrawService } from '../../../model/applications/draw-service';
import { ResultService } from '../../../model/applications/result-service';
import { useRouter } from 'vue-router';

export default {
  name: 'DrawView',
  components: { MainLayout, Button, Loader, Modal },
  setup() {
    const loading = ref(false);
    const showResult = ref(false);
  const winners = ref<LotteryResultDto[]>([]);
  const members = ref<MemberDto[]>([]);
    const router = useRouter();
    const drawService = new DrawService();
    const resultService = new ResultService();
    const executeDraw = async () => {
      loading.value = true;
      try {
        const drawRes = await drawService.executeDraw({ drawName: '抽選', candidateIds: ['1','2','3'], winnerCount: 1 });
        const resultRes = await resultService.getResult(drawRes.drawId);
        winners.value = resultRes.results;
        // 仮: メンバー情報を取得するAPI呼び出し（本来はServiceから取得）
        members.value = [
          { id: '1', name: '山田太郎', order: 1 },
          { id: '2', name: '佐藤花子', order: 2 },
          { id: '3', name: '鈴木一郎', order: 3 }
        ];
        showResult.value = true;
      } finally {
        loading.value = false;
      }
    };
    const goResult = () => router.push('/jackpot-result');
    // メンバー名取得関数
    const getMemberName = (memberId: string) => {
      const member = members.value.find(m => m.id === memberId);
      return member ? member.name : memberId;
    };
    return { loading, showResult, winners, executeDraw, goResult, getMemberName };
  },
};
</script>
