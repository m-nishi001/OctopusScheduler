<template>
    <teleport to="body">
        <div class="dialog-overlay" role="dialog" aria-modal="true">
            <div class="dialog-content">
                <h3 class="dialog-title">{{ title }}</h3>
                <div v-if="imageUrl1 || imageUrl2"
                    :class="['dialog-images-wrap', { 'single-image': imageUrl1 && !imageUrl2 }]">
                    <img v-if="imageUrl1" :src="imageUrl1" :alt="title + ' 画像1'" class="modal-image" />
                    <img v-if="imageUrl2" :src="imageUrl2" :alt="title + ' 画像2'" class="modal-image" />
                </div>
                <p class="dialog-message">
                    <slot>{{ message }}</slot>
                </p>
                <div class="dialog-actions">
                    <button v-if="showPrimary" class="btn-primary" type="button" @click.prevent.stop="() => { }">{{
                        primaryLabel }}</button>
                </div>
            </div>
        </div>
    </teleport>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onMounted, onUnmounted } from 'vue';
import { container } from 'tsyringe';
import { AssetDataService } from '@model/applications/asset/asset-data-service';

export default defineComponent({
    name: 'DrawResultDialog',
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
        const assetService = container.resolve(AssetDataService);
        const imageUrl1 = ref<string>('');
        const imageUrl2 = ref<string>('');

        const loadWinningImages = async () => {
            if (!props.prize) {
                return;
            }
            if (props.prize.winningImage1AssetId) {
                try {
                    const asset = await assetService.getAssetDataById(props.prize.winningImage1AssetId);
                    if (asset && asset.blob) {
                        imageUrl1.value = URL.createObjectURL(asset.blob);
                    }
                } catch (e) {
                    console.error('Failed to load winning image 1:', e);
                }
            } else if (props.prize.imageAssetId) {
                // fallback to roulette image
                try {
                    const asset = await assetService.getAssetDataById(props.prize.imageAssetId);
                    if (asset && asset.blob) {
                        imageUrl1.value = URL.createObjectURL(asset.blob);
                    }
                } catch (e) {
                    console.error('Failed to load fallback image:', e);
                }
            }

            if (props.prize.winningImage2AssetId) {
                try {
                    const asset = await assetService.getAssetDataById(props.prize.winningImage2AssetId);
                    if (asset && asset.blob) {
                        imageUrl2.value = URL.createObjectURL(asset.blob);
                    }
                } catch (e) {
                    console.error('Failed to load winning image 2:', e);
                }
            }
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
    /* Use grid to reliably center content both vertically and horizontally */
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.6);
    z-index: 10000;
}

.dialog-content {
    background: #000;
    border-radius: 12px;
    /* keep ~100px margin around viewport */
    width: calc(100vw - 200px);
    height: calc(100vh - 200px);
    max-width: 1200px;
    max-height: 900px;
    padding: 20px;
    box-sizing: border-box;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    /* hide native scrollbars for the modal itself */
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: stretch;
}

.dialog-title {
    font-size: 3rem;
    font-weight: 900;
    margin: 0 0 12px 0;
    color: #ffffff !important;
    text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6);
}

.dialog-images-wrap {
    margin: 0 0 12px 0;
    width: 100%;
    /* take remaining vertical space inside dialog so image can be large */
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border-radius: 12px;
    border: 3px solid #ffd700;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
    overflow: hidden;
}

.dialog-message {
    margin-bottom: 20px;
    color: white;
    font-size: 1.25rem;
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

.modal-image {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
    flex: 1 1 auto;
}

.dialog-images-wrap.single-image .modal-image {
    /* single image should take full available width */
    flex: 1 1 100%;
    max-width: 100%;
}

@media (max-width: 480px) {

    /* small screens: reduce margins so dialog fits nicely */
    .dialog-content {
        width: calc(100vw - 40px);
        height: calc(100vh - 80px);
        padding: 12px;
    }

    .dialog-images-wrap {
        gap: 8px;
    }

    .dialog-title {
        font-size: 2rem;
    }

    .btn-primary {
        padding: 14px 36px;
        font-size: 1.2rem;
    }
}

/* Ensure title/message/actions do not overflow the dialog; image area uses remaining space */
.dialog-title {
    flex: 0 0 auto;
}

.dialog-message {
    flex: 0 0 auto;
}

.dialog-actions {
    flex: 0 0 auto;
}
</style>
