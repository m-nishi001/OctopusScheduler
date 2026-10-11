<template>
    <teleport to="body">
        <div class="modal-overlay jp-stage" data-testid="half-remaining-dialog">
            <div class="jp-rays" aria-hidden="true"></div>
            <div class="modal-content jp-frame jp-pop-in">
                <p class="kicker jp-gold-text">HALF WAY</p>
                <h2 class="highlight">景品があと半分になりました</h2>
            </div>
        </div>
    </teleport>
</template>

<script lang="ts">
import { defineComponent, watch } from 'vue';
import '../../theme/jackpot-theme.css';

export default defineComponent({
    name: 'HalfRemainingDialog',
    props: {
        visible: { type: Boolean, default: false },
    },
    emits: ['close'],
    setup(props, { emit }) {
        watch(() => props.visible, (newVal) => {
            if (newVal) {
                setTimeout(() => {
                    emit('close');  // 3秒後に自動クローズ
                }, 3000);
            }
        }, { immediate: true });
        return {};
    },
});
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background-color: var(--jp-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20000;
}

.modal-content {
    position: relative;
    z-index: 1;
    padding: 40px 64px;
    max-width: calc(100vw - 48px);
    box-sizing: border-box;
    text-align: center;
}

.kicker {
    margin: 0 0 8px;
    font-size: clamp(1.1rem, 2vw, 1.8rem);
    font-weight: 900;
    letter-spacing: 0.6em;
    text-indent: 0.6em;
}

.highlight {
    margin: 0;
    color: var(--jp-text);
    font-size: clamp(2rem, 5vw, 4.2rem);
    font-weight: 900;
    text-shadow: var(--jp-glow), 0 3px 0 rgba(0, 0, 0, 0.7);
    animation: half-pulse 1.2s ease-in-out infinite;
}

@keyframes half-pulse {

    0%,
    100% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.04);
    }
}

@media (prefers-reduced-motion: reduce) {
    .highlight {
        animation: none;
    }
}
</style>
