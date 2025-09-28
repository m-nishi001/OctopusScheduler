<template>
  <MainLayout>
    <h2 class="jp-title">抽選実行</h2>
    <Button @click="executeDraw" :disabled="loading">抽選する</Button>
    <Loader v-if="loading" />
    <Modal :visible="showResult" @close="showResult = false">
      <h3 class="jp-modal-title">抽選結果</h3>
      <ul class="jp-winner-list">
        <li v-for="winner in winners" :key="winner.memberId" class="jp-winner-item">{{ getMemberName(winner.memberId) }}
        </li>
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
      box-shadow: 0 2px 8px rgba(42, 82, 152, 0.08);
    }
  </style>
</template>

<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import Button from '../common/button.vue';
import Loader from '../common/loader.vue';
import Modal from '../common/modal.vue';
import { useDraw } from '../../composables/use-draw';

export default {
  name: 'DrawView',
  components: { MainLayout, Button, Loader, Modal },
  setup() {
    return useDraw();
  },
};
</script>
