<template>
  <MainLayout>
    <h2 class="jp-title">抽選結果</h2>
    <ul class="jp-winner-list">
      <li v-for="winner in winners" :key="winner.id" class="jp-winner-item">{{ winner.name }}</li>
    </ul>
    <Button @click="goHome">ホームへ戻る</Button>
    <Button customClass="ml-2" @click="goHistory">履歴を見る</Button>
  </MainLayout>
</template>

<script lang="ts">
import MainLayout from '../common/MainLayout.vue';
import Button from '../common/Button.vue';
import { ref, onMounted } from 'vue';
import type { User } from '../../../model/domains/user/User';
import { useRouter } from 'vue-router';
import { ResultService } from '../../../model/applications/ResultService';

export default {
  name: 'ResultView',
  components: { MainLayout, Button },
  setup() {
    const winners = ref<User[]>([]);
    const router = useRouter();
    const resultService = new ResultService();
    onMounted(async () => {
      // TODO: drawIdはルートパラメータ等から取得
      const resultRes = await resultService.getResult('drawId');
      winners.value = resultRes.winners;
    });
    const goHome = () => router.push('/');
    const goHistory = () => router.push('/history');
    return { winners, goHome, goHistory };
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
.ml-2 {
  margin-left: 8px;
}
</style>
