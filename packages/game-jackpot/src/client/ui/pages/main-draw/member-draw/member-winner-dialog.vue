<template>
  <teleport to="body">
    <div v-if="visible" class="dialog-overlay" role="dialog" aria-modal="true">
      <div class="dialog-content">
        <h3 class="dialog-title">{{ title }}</h3>
        <div v-if="imageUrl" class="dialog-image-wrap">
          <img :src="imageUrl" alt="winner" class="modal-image" />
        </div>
        <div class="dialog-actions">
          <!-- Inert: clicking does not close; parent orchestrator will handle flow via Enter/currentAction -->
          <button ref="nextBtn" type="button" class="btn-primary" @click.prevent.stop="() => { }">次へ</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  visible: { type: Boolean, required: true },
  title: { type: String, required: true },
  imageUrl: { type: String, default: '' },
});

const emit = defineEmits<{
  shown: [];
  closed: [];
}>();

const nextBtn = ref<HTMLButtonElement | null>(null);

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden';
    // wait for DOM update then focus the primary action so Enter works reliably
    try {
      await nextTick();
      // notify parent immediately so it can lock input
      try { emit('shown'); } catch (e) { /* ignore */ }
      // delay focusing the button by 1s so that a held Enter doesn't immediately activate it
      setTimeout(() => {
        try { nextBtn.value?.focus(); } catch (e) { /* ignore */ }
      }, 1000);
    } catch (e) {
      // ignore focus errors
    }
  } else {
    document.body.style.overflow = '';
    try { emit('closed'); } catch (e) { /* ignore */ }
  }
});
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10000;
}

.dialog-content {
  background: #000;
  border-radius: 20px;
  padding: 48px;
  width: 760px;
  box-sizing: border-box;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  border: 2px solid #ffd700;
}

.dialog-title {
  font-size: 3rem;
  font-weight: 900;
  margin-bottom: 18px;
  color: #ffffff !important;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6);
  /* preserve explicit newlines and prevent automatic wrapping */
  white-space: pre;
  word-break: normal;
}

.dialog-image-wrap {
  margin-bottom: 12px;
}

.modal-image {
  max-width: 460px;
  max-height: 460px;
  object-fit: cover;
  display: block;
  margin: 0 auto 20px auto;
  border-radius: 12px;
  border: 3px solid #ffd700;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
}

.dialog-actions {
  margin-top: 18px;
}

.btn-primary {
  background: linear-gradient(90deg, #ffd700, #ff6b35);
  color: black;
  padding: 20px 56px;
  border-radius: 24px;
  border: none;
  cursor: pointer;
  font-weight: 900;
  font-size: 1.8rem;
  box-shadow: 0 10px 30px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 107, 53, 0.25);
}
</style>
