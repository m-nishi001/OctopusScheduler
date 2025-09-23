<template>
  <MainLayout>
    <h2>抽選結果</h2>
    <ul>
      <li v-for="winner in winners" :key="winner.id">{{ winner.name }}</li>
    </ul>
    <Button @click="goHome">ホームへ戻る</Button>
    <Button customClass="ml-2" @click="goHistory">履歴を見る</Button>
  </MainLayout>
</template>

<script lang="ts">
import MainLayout from './MainLayout.vue';
import Button from './Button.vue';
import { ref, onMounted } from 'vue';
import type { User } from '../../model/domains/user/User';
import { useRouter } from 'vue-router';
import { ResultService } from '../../model/applications/ResultService';

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
.ml-2 {
  margin-left: 8px;
}
</style>
