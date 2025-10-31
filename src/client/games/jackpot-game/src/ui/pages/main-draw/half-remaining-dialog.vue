<template>
    <div class="modal-overlay" v-if="visible">
        <div class="modal-content">
            <h2 class="highlight">景品があと半分になりました</h2>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, watch } from 'vue';

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
        });
        return {};
    },
});
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.modal-content {
    background: white;
    padding: 20px;
    border-radius: 10px;
    text-align: center;
}

.highlight {
    color: red;
    font-size: 1.5em;
    animation: blink 1s infinite;
    /* 演出: 点滅アニメーション */
}

@keyframes blink {

    0%,
    50% {
        opacity: 1;
    }

    51%,
    100% {
        opacity: 0.5;
    }
}
</style>