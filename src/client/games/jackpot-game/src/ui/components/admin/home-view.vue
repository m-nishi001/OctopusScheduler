<template>
  <MainLayout>
    <h2>Jackpod ホーム</h2>
    <Button @click="goAdmin">管理画面</Button>
    <Button customClass="ml-2" @click="goOpening">スタート</Button>
  </MainLayout>
</template>

<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import Button from '../common/button.vue';
import { useRouter } from 'vue-router';

export default {
  name: 'HomeView',
  components: { MainLayout, Button },
  setup() {
    const router = useRouter();
    const goAdmin = () => router.push('/jackpot-admin');
    const goOpening = () => router.push('/jackpot-opening');
    return { goAdmin, goOpening };
  },
};
</script>

<style scoped>
.ml-2 { margin-left: 8px; }
</style>
