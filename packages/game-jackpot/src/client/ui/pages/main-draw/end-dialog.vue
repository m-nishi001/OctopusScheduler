<template>
    <div class="modal-overlay jp-stage" data-testid="end-dialog" :data-reason="reason">
        <div class="jp-rays" aria-hidden="true"></div>
        <JackpotConfetti :count="180" :duration-ms="12000" />
        <div class="modal-content jp-frame jp-pop-in">
            <p class="kicker jp-gold-text">FINISH</p>
            <h2 class="highlight jp-gold-text">おしまい！！</h2>
            <p class="message" data-testid="end-message">{{ message }}</p>
            <button class="jp-button" data-testid="end-ok" @click="closeDialog">OK</button>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue';
import type { DrawEndReason } from '@control/draw/dto/draw-progress';
import JackpotConfetti from '../../components/jackpot-confetti.vue';
import '../../theme/jackpot-theme.css';

/** 終了の理由ごとの文言。景品が残っていてもメンバーが尽きれば終わるので、取り違えない文言にする。 */
export const END_MESSAGES: Record<DrawEndReason, string> = {
    prizes: 'すべての景品が皆さんの手元にいきました。',
    members: '対象のメンバー全員の抽選が終わりました。',
};

// 閉じる操作(OKボタン・Enter・管理端末の「次へ」)は、すべて抽選の進行役(DrawFlowController)が受ける。
// この画面は表示だけで、OKボタンは close を通知する(親が進行操作として扱う)。
export default defineComponent({
    name: 'EndDialog',
    components: { JackpotConfetti },
    props: {
        reason: { type: String as PropType<DrawEndReason>, required: true },
    },
    emits: ['close'],
    setup(props, { emit }) {
        const message = computed(() => END_MESSAGES[props.reason]);
        return { message, closeDialog: () => emit('close') };
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
