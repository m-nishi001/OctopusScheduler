<template>
    <div class="modal-overlay" ref="overlay" tabindex="-1">
        <div class="firework" v-for="i in 20" :key="i"
            :style="{ left: Math.random() * 100 + '%', animationDelay: Math.random() * 3 + 's' }"></div>
        <div class="modal-content">
            <h2 class="highlight">おしまい！！</h2>
            <p>すべての景品が皆さんの手元にいきました。</p>
            <button class="ok-button" @click="closeDialog">OK</button>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, watch, onMounted, onUnmounted, ref, nextTick } from 'vue';

export default defineComponent({
    name: 'EndDialog',
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
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle, #000000 0%, #1a1a1a 50%, #000000 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    overflow: hidden;
}

.firework {
    position: absolute;
    top: -10px;
    width: 8px;
    height: 8px;
    background: radial-gradient(circle, gold, #ffd700);
    border-radius: 50%;
    box-shadow: 0 0 5px gold;
    animation: fall 4s linear infinite;
}

@keyframes fall {
    0% {
        transform: translateY(0) scale(1);
        opacity: 1;
    }

    50% {
        transform: translateY(50vh) scale(1.2);
        opacity: 0.8;
    }

    100% {
        transform: translateY(100vh) scale(0);
        opacity: 0;
    }
}

.modal-content {
    background: linear-gradient(135deg, #000000, #2a2a2a);
    padding: 40px;
    border-radius: 20px;
    text-align: center;
    box-shadow: 0 0 50px rgba(255, 215, 0, 0.8), 0 0 100px rgba(255, 215, 0, 0.5);
    animation: jackpotGlow 1.5s ease-in-out infinite alternate;
    border: 5px solid gold;
    position: relative;
    z-index: 10;
}

.highlight {
    font-size: 3em;
    font-weight: bold;
    color: gold;
    text-shadow: 0 0 20px gold, 0 0 40px gold, 0 0 60px gold;
    animation: jackpotPulse 1s ease-in-out infinite;
    margin-bottom: 20px;
}

p {
    font-size: 1.5em;
    color: #ffffff;
    text-shadow: 0 0 10px gold;
    margin-bottom: 30px;
}

.ok-button {
    background: linear-gradient(45deg, #ffd700, #ffed4e);
    color: #000000;
    border: 2px solid gold;
    padding: 15px 30px;
    font-size: 1.2em;
    font-weight: bold;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 5px 15px rgba(255, 215, 0, 0.5);
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.ok-button:hover {
    transform: scale(1.1);
    box-shadow: 0 10px 25px rgba(255, 215, 0, 0.8);
    background: linear-gradient(45deg, #ffed4e, #ffd700);
}

@keyframes jackpotGlow {
    0% {
        box-shadow: 0 0 50px rgba(255, 215, 0, 0.8), 0 0 100px rgba(255, 215, 0, 0.5);
    }

    100% {
        box-shadow: 0 0 70px rgba(255, 215, 0, 1), 0 0 140px rgba(255, 215, 0, 0.7);
    }
}

@keyframes jackpotPulse {

    0%,
    100% {
        transform: scale(1);
        text-shadow: 0 0 20px gold, 0 0 40px gold, 0 0 60px gold;
    }

    50% {
        transform: scale(1.05);
        text-shadow: 0 0 30px gold, 0 0 60px gold, 0 0 90px gold;
    }
}
</style>