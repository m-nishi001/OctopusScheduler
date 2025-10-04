<template>
  <MainLayout>
    <h2 class="jp-title">抽選履歴</h2>
    <ul class="jp-history-list">
      <li v-for="item in history" :key="item.id" class="jp-history-item">
        <span class="jp-history-name">{{ item.drawName }}</span>
        <span class="jp-history-date">{{ item.result.executedAt }}</span>
        <Button @click="viewDetail(item.id)" customClass="jp-detail-btn">詳細</Button>
      </li>
    </ul>
    <Button @click="goHome">ホームへ戻る</Button>
  </MainLayout>
  <style scoped>
    .jp-title {
      font-size: 2.2em;
      color: #fff;
      text-shadow: 0 2px 12px #2a5298;
      margin-bottom: 32px;
      font-family: 'Orbitron', 'Montserrat', sans-serif;
    }

    .jp-history-list {
      list-style: none;
      padding: 0;
      margin-bottom: 24px;
    }

    .jp-history-item {
      background: linear-gradient(90deg, #e3eafc 0%, #fff 100%);
      color: #2a5298;
      font-size: 1.1em;
      font-family: 'Montserrat', sans-serif;
      margin: 8px 0;
      padding: 10px 18px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(42, 82, 152, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .jp-history-name {
      font-weight: 600;
      margin-right: 16px;
    }

    .jp-history-date {
      font-size: 0.95em;
      color: #607d8b;
      margin-right: 16px;
    }

    .jp-detail-btn {
      margin-left: auto;
    }
  </style>
</template>

<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import Button from '../common/button.vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { HistoryService } from '../../../model/applications/history-service';
import { container } from 'tsyringe';

export default {
  name: 'HistoryView',
  components: { MainLayout, Button },
  setup() {
    const historyService = container.resolve(HistoryService);
    const history = ref<any[]>([]);
    const fetchHistory = async () => {
      history.value = await historyService.getHistory();
    };
    const router = useRouter();
    onMounted(() => {
      fetchHistory();
    });
    const viewDetail = (id: string) => router.push(`/history/${id}`);
    const goHome = () => router.push('/');
    return { history, viewDetail, goHome };
  },
};
</script>
