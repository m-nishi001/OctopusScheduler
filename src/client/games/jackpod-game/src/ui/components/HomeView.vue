<template>
  <MainLayout>
    <h2>抽選を開始する</h2>
    <Button @click="startDraw">抽選開始</Button>
    <Button customClass="ml-2" @click="goHistory">履歴を見る</Button>
  </MainLayout>
</template>

<script lang="ts">
import MainLayout from './MainLayout.vue';
import Button from './Button.vue';
import { useRouter } from 'vue-router';

export default {
  name: 'HomeView',
  components: { MainLayout, Button },
  setup() {
    const router = useRouter();
    const startDraw = () => router.push('/draw');
    const goHistory = () => router.push('/history');
    return { startDraw, goHistory };
  },
};
</script>

<style scoped>
.ml-2 { margin-left: 8px; }
</style>
