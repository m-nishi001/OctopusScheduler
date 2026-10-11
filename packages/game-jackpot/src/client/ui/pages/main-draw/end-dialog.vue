<template>
    <div class="modal-overlay jp-stage" ref="overlay" tabindex="-1" data-testid="end-dialog">
        <div class="jp-rays" aria-hidden="true"></div>
        <JackpotConfetti :count="180" :duration-ms="12000" />
        <div class="modal-content jp-frame jp-pop-in">
            <p class="kicker jp-gold-text">FINISH</p>
            <h2 class="highlight jp-gold-text">おしまい！！</h2>
            <p class="message">すべての景品が皆さんの手元にいきました。</p>
            <button class="jp-button" @click="closeDialog">OK</button>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, watch, onMounted, onUnmounted, ref, nextTick } from 'vue';
import JackpotConfetti from '../../components/jackpot-confetti.vue';
import '../../theme/jackpot-theme.css';

export default defineComponent({
    name: 'EndDialog',
    components: { JackpotConfetti },
    props: {
        visible: { type: Boolean, default: false },
    },
    emits: ['close'],
    setup(props, { emit }) {
        const overlay = ref<HTMLDivElement | null>(null);
        let keydownTimer: number | null = null;

        const closeDialog = () => {
            emit('close');
        };

        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                closeDialog();
            }
        };

        watch(() => props.visible, (newVal) => {
            if (newVal) {
                nextTick(() => {
                    overlay.value?.focus();
                });
                // delay attaching keydown handler to ensure dialog is shown
                // for at least 1 second before Enter can close it
                keydownTimer = window.setTimeout(() => {
                    window.addEventListener('keydown', handleKeydown);
                    keydownTimer = null;
                }, 1000);
            } else {
                if (keydownTimer != null) {
                    clearTimeout(keydownTimer);
                    keydownTimer = null;
                }
                window.removeEventListener('keydown', handleKeydown);
            }
        });

        onMounted(() => {
            if (props.visible) {
                nextTick(() => {
                    overlay.value?.focus();
                });
                // attach delayed as well on mount
                keydownTimer = window.setTimeout(() => {
                    window.addEventListener('keydown', handleKeydown);
                    keydownTimer = null;
                }, 1000);
            }
        });

        onUnmounted(() => {
            if (keydownTimer != null) {
                clearTimeout(keydownTimer);
                keydownTimer = null;
            }
            window.removeEventListener('keydown', handleKeydown);
        });

        return {
            overlay,
            closeDialog,
        };
    },
});
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background-color: var(--jp-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    overflow: hidden;
    outline: none;
}

.modal-content {
    position: relative;
    z-index: 1;
    padding: 48px 72px;
    max-width: calc(100vw - 48px);
    box-sizing: border-box;
    text-align: center;
}

.kicker {
    margin: 0 0 4px;
    font-size: clamp(1.1rem, 2vw, 1.8rem);
    font-weight: 900;
    letter-spacing: 0.6em;
    text-indent: 0.6em;
}

.highlight {
    margin: 0 0 20px;
    font-size: clamp(3rem, 8vw, 6.5rem);
    font-weight: 900;
}

.message {
    margin: 0 0 32px;
    font-size: clamp(1.1rem, 2.2vw, 1.8rem);
    color: var(--jp-text);
    text-shadow: 0 0 10px rgba(255, 213, 74, 0.6);
}
</style>
