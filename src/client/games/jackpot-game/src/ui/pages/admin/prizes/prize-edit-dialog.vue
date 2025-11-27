<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-content wide-modal">
      <div class="dialog-grid">
        <div class="dialog-main">
          <h3>景品詳細</h3>
          <PrizeForm mode="edit" :prize="prize" :image-assets="imageAssets" :audio-assets="audioAssets"
            @submit="onSubmit" @cancel="closeModal" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PrizeForm from '../../../components/prizes/prize-form.vue';
import type { Asset } from '@model/domains/drive-data/asset-data';
import { PrizeService } from '@model/applications/prize/prize-service';
import { container } from 'tsyringe';

const props = defineProps({
  show: { type: Boolean, required: false },
  prize: { type: Object, required: true },
  imageAssets: { type: Array as () => Asset[], required: true },
  audioAssets: { type: Array as () => Asset[], required: true },
  objectUrlMap: { type: Object, required: true },
});

const emit = defineEmits(['close', 'refresh']);

const closeModal = () => {
  emit('close');
};

const onSubmit = async (formData: any) => {
  try {
    const prizeService = container.resolve(PrizeService);
    await prizeService.updatePrize(props.prize.id, formData);
    emit('refresh');
    closeModal();
  } catch (error) {
    console.error('Failed to update prize:', error);
    // Optionally show user error
  }
};
</script>

<style scoped>
/* Same modal styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  z-index: 1100;
}

.modal-content {
  background: linear-gradient(135deg, #232b36 0%, #2a3441 100%);
  color: #fff;
  padding: 28px;
  border-radius: 16px;
  text-align: left;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  max-width: 880px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-sizing: border-box;
}

.modal-content.wide-modal {
  width: min(86vw, 1100px);
  margin: 0 auto;
  max-width: 1100px;
  max-height: calc(100vh - 96px);
  display: flex;
  flex-direction: column;
}

.dialog-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  align-items: start;
  margin-top: 8px;
  min-height: 0;
}

.dialog-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
</style>
