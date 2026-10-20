<template>
  <teleport to="body">
    <div v-if="visible" class="dialog-overlay jp-stage" role="dialog" aria-modal="true" data-testid="member-winner-dialog">
      <div class="jp-rays" aria-hidden="true"></div>
      <div class="jp-flash" aria-hidden="true"></div>
      <JackpotConfetti :count="110" :duration-ms="3500" />
      <div class="dialog-content jp-frame jp-pop-in">
        <p class="dialog-kicker jp-gold-text">WINNER</p>
        <div v-if="imageUrl" class="dialog-image-wrap">
          <img :src="imageUrl" alt="winner" class="modal-image" />
        </div>
        <h3 class="dialog-title" data-testid="member-winner-name">{{ title }}</h3>
        <div class="dialog-actions">
          <!-- Inert: clicking does not close; parent orchestrator will handle flow via Enter/currentAction -->
          <button ref="nextBtn" type="button" class="jp-button" @click.prevent.stop="() => { }">次へ</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { lockScroll } from '@octopus/ui-kit';
import JackpotConfetti from '../../../components/jackpot-confetti.vue';
import '../../../theme/jackpot-theme.css';

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

let releaseScroll: (() => void) | null = null;
const unlockScroll = () => {
  releaseScroll?.();
  releaseScroll = null;
};
onBeforeUnmount(unlockScroll);

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    releaseScroll ??= lockScroll();
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
    unlockScroll();
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
  overflow: hidden;
  background-color: var(--jp-ink);
  z-index: 10000;
}

.dialog-overlay>.jp-rays {
  inset: -80%;
}

.dialog-content {
  position: relative;
  z-index: 1;
  padding: 36px 56px;
  width: min(760px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  box-sizing: border-box;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.dialog-kicker {
  margin: 0;
  font-size: clamp(1.2rem, 2.4vw, 2rem);
  font-weight: 900;
  letter-spacing: 0.6em;
  text-indent: 0.6em;
}

.dialog-title {
  margin: 0;
  max-width: 100%;
  font-size: clamp(1.6rem, 3.4vw, 3rem);
  font-weight: 900;
  line-height: 1.4;
  text-wrap: balance;
  word-break: auto-phrase;
  color: var(--jp-text);
  text-shadow: var(--jp-glow), 0 3px 0 rgba(0, 0, 0, 0.7);
  /* 明示的な改行は保持し、長い名前は枠内で折り返す */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  animation: member-name-in 800ms var(--jp-ease-pop) 200ms both;
}

@keyframes member-name-in {
  from {
    opacity: 0;
    transform: scale(0.4);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog-image-wrap {
  min-height: 0;
  display: flex;
  justify-content: center;
}

.modal-image {
  max-width: min(420px, 100%);
  max-height: min(42vh, 420px);
  object-fit: cover;
  display: block;
  border-radius: 50%;
  border: 5px solid var(--jp-gold);
  box-shadow: var(--jp-glow);
}

.dialog-actions {
  margin-top: 8px;
}
</style>
