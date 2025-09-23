<template>
  <MainLayout>
    <h2>抽選実行</h2>
    <Button @click="executeDraw" :disabled="loading">抽選する</Button>
    <Loader v-if="loading" />
    <Modal :visible="showResult" @close="showResult = false">
      <h3>抽選結果</h3>
      <ul>
        <li v-for="winner in winners" :key="winner.id">{{ winner.name }}</li>
      </ul>
      <Button @click="goResult">結果画面へ</Button>
    </Modal>
  </MainLayout>
</template>

<script lang="ts">
import MainLayout from './MainLayout.vue';
import Button from './Button.vue';
import Loader from './Loader.vue';
import Modal from './Modal.vue';
import { ref } from 'vue';
import type { User } from '../../model/domains/user/User';
import { DrawService } from '../../model/applications/DrawService';
import { ResultService } from '../../model/applications/ResultService';
import { useRouter } from 'vue-router';

export default {
  name: 'DrawView',
  components: { MainLayout, Button, Loader, Modal },
  setup() {
    const loading = ref(false);
    const showResult = ref(false);
  const winners = ref<User[]>([]);
    const router = useRouter();
    const drawService = new DrawService();
    const resultService = new ResultService();
    const executeDraw = async () => {
      loading.value = true;
      try {
        const drawRes = await drawService.executeDraw({ drawName: '抽選', candidateIds: ['1','2','3'], winnerCount: 1 });
        const resultRes = await resultService.getResult(drawRes.drawId);
        winners.value = resultRes.winners;
        showResult.value = true;
      } finally {
        loading.value = false;
      }
    };
    const goResult = () => router.push('/result');
    return { loading, showResult, winners, executeDraw, goResult };
  },
};
</script>
