<template>
  <div v-if="!deleting" class="modal-overlay">
    <div class="modal-content">
      <h3>景品を削除</h3>
      <p>選択した景品を削除しますか？</p>
      <div class="modal-actions">
        <button class="admin-btn delete-btn" @click="$emit('confirm')">削除</button>
        <button class="admin-btn" @click="$emit('cancel')">キャンセル</button>
      </div>
    </div>
  </div>
  <div v-else class="modal-overlay">
    <div class="modal-content">
      <h3>削除中...</h3>
      <p>{{ deleteMessage }}</p>
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  deleting: { type: Boolean, default: false },
  deleteMessage: { type: String, default: '' },
});
defineEmits(['confirm', 'cancel']);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: linear-gradient(135deg, #232b36 0%, #2a3441 100%);
  color: #fff;
  padding: 28px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: 420px;
  width: 90%;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-btn {
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(79, 140, 255, 0.2);
}

.admin-btn:hover {
  box-shadow: 0 8px 20px rgba(79, 140, 255, 0.3);
  transform: translateY(-2px);
}

.delete-btn {
  background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%);
}

.delete-btn:hover {
  box-shadow: 0 6px 18px rgba(255, 107, 107, 0.14);
}

.modal-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.spinner {
  margin: 16px auto;
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4f8cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
