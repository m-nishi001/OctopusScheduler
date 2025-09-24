<template>
  <MainLayout>
    <h2>オープニング画面</h2>
    <p>Jackpodゲームへようこそ！</p>
    <Button @click="goDraw">抽選画面へ</Button>
  </MainLayout>
</template>

<script lang="ts">
import MainLayout from '../common/MainLayout.vue';
import Button from '../common/Button.vue';
import { useRouter } from 'vue-router';

export default {
  name: 'OpeningView',
  components: { MainLayout, Button },
  setup() {
    const router = useRouter();
    const goDraw = () => router.push('/jackpot-draw');
    return { goDraw };
  },
};
</script>

<style scoped>
main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
h2 {
  font-size: 2.5em;
  color: #fff;
  text-shadow: 0 2px 16px #2a5298;
  margin-bottom: 24px;
}
p {
  font-size: 1.3em;
  color: #e0e0e0;
  margin-bottom: 32px;
}
</style>
