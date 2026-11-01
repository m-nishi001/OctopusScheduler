<template>
    <teleport to="body">
        <div class="dialog-overlay jp-stage" role="dialog" aria-modal="true" data-testid="prize-winning-dialog">
            <div class="jp-rays" aria-hidden="true"></div>
            <div class="jp-flash" aria-hidden="true"></div>
            <JackpotConfetti />
            <div :class="['dialog-content', 'jp-frame', 'jp-pop-in', { 'no-image': !imageUrl1 && !imageUrl2 }]">
                <h3 class="dialog-title jp-gold-text">{{ title }}</h3>
                <!-- 画像が未設定の賞品でも、何が当たったかが必ず分かるように賞品名を出す -->
                <p class="prize-name" data-testid="prize-winning-name">{{ prize.name }}</p>
                <div v-if="imageUrl1 || imageUrl2"
                    :class="['dialog-images-wrap', { 'single-image': imageUrl1 && !imageUrl2 }]">
                    <img v-if="imageUrl1" :src="imageUrl1" :alt="title + ' 画像1'" class="modal-image" />
                    <img v-if="imageUrl2" :src="imageUrl2" :alt="title + ' 画像2'" class="modal-image" />
                </div>
                <p v-if="message || $slots.default" class="dialog-message">
                    <slot>{{ message }}</slot>
                </p>
                <div class="dialog-actions">
                    <button v-if="showPrimary" class="jp-button" type="button" @click.prevent.stop="() => { }">{{
                        primaryLabel }}</button>
                </div>
            </div>
        </div>
    </teleport>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onMounted, onUnmounted } from 'vue';
import { container } from 'tsyringe';
import { JackpotRepository } from '@model/jackpot-repository';
import JackpotConfetti from '../../components/jackpot-confetti.vue';
import '../../theme/jackpot-theme.css';

export default defineComponent({
    name: 'DrawResultDialog',
    components: { JackpotConfetti },
    props: {
        title: { type: String, required: true },
        message: { type: String, required: false, default: '' },
        primaryLabel: { type: String, required: false, default: '次へ' },
        // whether to show the primary action button. Allows callers to display a passive dialog without actions.
        showPrimary: { type: Boolean, required: false, default: false },
        prize: { type: Object, required: true }
    },
    emits: ['close'],
    setup(props, { emit }) {
        const repo = container.resolve(JackpotRepository);
        const imageUrl1 = ref<string>('');
        const imageUrl2 = ref<string>('');

        /** 素材の名前の画像を、表示用の URL にする。無い・読めないときは空。 */
        const urlOf = async (name: string | undefined): Promise<string> => {
            if (!name) return '';
            try {
                const blob = await repo.blobOf(name);
                return blob ? URL.createObjectURL(blob) : '';
            } catch (e) {
                console.error('Failed to load prize image:', name, e);
                return '';
            }
        };

        const loadWinningImages = async () => {
            if (!props.prize) {
                return;
            }
            // 当選画像1が無ければ、ルーレットの画像を使う
            imageUrl1.value = await urlOf(props.prize.winningImage1 || props.prize.image);
            imageUrl2.value = await urlOf(props.prize.winningImage2);
        };

        watch(
            () => props.prize,
            (p) => {
                if (p) {
                    void loadWinningImages();
                } else {
                    // clear images when prize becomes unset
                    imageUrl1.value = '';
                    imageUrl2.value = '';
                }
            },
            { immediate: true }
        );

        onMounted(() => {
            if (props.prize) {
                void loadWinningImages();
            }
        });

        onUnmounted(() => {
            if (imageUrl1.value) {
                URL.revokeObjectURL(imageUrl1.value);
            }
            if (imageUrl2.value) {
                URL.revokeObjectURL(imageUrl2.value);
            }
        });

        const close = () => emit('close');
        return { close, imageUrl1, imageUrl2 };
    }
});
</script>

<style scoped>
.dialog-overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
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
    width: calc(100vw - 200px);
    height: calc(100vh - 200px);
    max-width: 1200px;
    max-height: 900px;
    padding: 28px 32px;
    box-sizing: border-box;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
}

.dialog-title {
    flex: 0 0 auto;
    margin: 0 0 8px 0;
    font-size: clamp(1.8rem, 3.4vw, 3rem);
    font-weight: 900;
    letter-spacing: 0.4em;
    text-indent: 0.4em;
}

.prize-name {
    flex: 0 0 auto;
    margin: 0 0 16px 0;
    font-size: clamp(2.5rem, 7vw, 6rem);
    font-weight: 900;
    line-height: 1.15;
    overflow-wrap: anywhere;
    color: var(--jp-text);
    text-shadow: var(--jp-glow), 0 3px 0 rgba(0, 0, 0, 0.7);
    animation: prize-name-in 900ms var(--jp-ease-pop) 250ms both;
}

@keyframes prize-name-in {
    from {
        opacity: 0;
        transform: scale(0.3) translateY(30px);
        letter-spacing: 0.3em;
    }

    to {
        opacity: 1;
        transform: scale(1) translateY(0);
        letter-spacing: 0;
    }
}

.dialog-images-wrap {
    margin: 0 0 12px 0;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border-radius: 16px;
    border: 3px solid var(--jp-gold);
    box-shadow: var(--jp-glow);
    overflow: hidden;
}

.dialog-message {
    flex: 0 0 auto;
    margin-bottom: 20px;
    color: var(--jp-text);
    font-size: 1.25rem;
}

.dialog-actions {
    flex: 0 0 auto;
    margin-top: 18px;
}

.modal-image {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
    flex: 1 1 auto;
    min-height: 0;
}

.dialog-images-wrap.single-image .modal-image {
    flex: 1 1 100%;
    max-width: 100%;
}

/* 画像が無い賞品は、賞品名が主役の引き締まったサイズにする */
.dialog-content.no-image {
    height: auto;
    min-height: 46vh;
    padding: 56px 72px;
}

@media (max-width: 480px) {
    .dialog-content {
        width: calc(100vw - 40px);
        height: calc(100vh - 80px);
        padding: 12px;
    }

    .dialog-images-wrap {
        gap: 8px;
    }
}
</style>
