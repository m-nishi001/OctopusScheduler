<template>
  <MainLayout>
    <h2>抽選履歴</h2>
    <ul>
      <li v-for="item in history" :key="item.id">
        {{ item.drawName }} - {{ item.result.executedAt }}
        <Button @click="viewDetail(item.id)">詳細</Button>
      </li>
    </ul>
    <Button @click="goHome">ホームへ戻る</Button>
  </MainLayout>
</template>

<script lang="ts">
import MainLayout from './MainLayout.vue';
import Button from './Button.vue';
import { ref, onMounted } from 'vue';
import type { History } from '../../model/domains/history/History';
import { useRouter } from 'vue-router';
import { HistoryService } from '../../model/applications/HistoryService';

export default {
  name: 'HistoryView',
  components: { MainLayout, Button },
  setup() {
  const history = ref<History[]>([]);
    const router = useRouter();
    const historyService = new HistoryService();
    onMounted(async () => {
      history.value = await historyService.getHistory();
    });
    const viewDetail = (id: string) => router.push(`/history/${id}`);
    const goHome = () => router.push('/');
    return { history, viewDetail, goHome };
  },
};
</script>
