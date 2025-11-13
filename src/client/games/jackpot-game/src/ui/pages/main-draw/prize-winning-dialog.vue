<template>
    <teleport to="body">
        <div class="dialog-overlay" role="dialog" aria-modal="true">
            <div class="dialog-content">
                <h3 class="dialog-title">{{ title }}</h3>
                <div v-if="imageUrl" class="dialog-image-wrap">
                    <img :src="imageUrl" :alt="title" class="modal-image" />
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
        showPrimary: { type: Boolean, required: false, default: true },
        assetId: { type: String, required: false, default: '' }
    },
    emits: ['close'],
    setup(props, { emit }) {
        const assetService = container.resolve(AssetDataService);
        const imageUrl = ref<string>('');

        const loadImage = async () => {
            if (props.assetId) {
                try {
                    const asset = await assetService.getAssetDataById(props.assetId);
                    if (asset && asset.blob) {
                        imageUrl.value = URL.createObjectURL(asset.blob);
                    }
                } catch (e) {
                    console.error('Failed to load asset:', e);
                }
            } else {
                imageUrl.value = '';
            }
        };

        watch(() => props.assetId, loadImage);

        onMounted(loadImage);

        onUnmounted(() => {
            if (imageUrl.value) {
                URL.revokeObjectURL(imageUrl.value);
            }
        });

        const close = () => emit('close');
        return { close, imageUrl };
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
    /* larger size */
    box-sizing: border-box;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    border: 2px solid #ffd700;
    /* gold border for jackpot feel */
}

.dialog-title {
    font-size: 3rem;
    font-weight: 900;
    margin-bottom: 18px;
    color: #ffffff !important;
    text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6);
}

.dialog-image-wrap {
    margin-bottom: 12px;
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
    max-width: 460px;
    max-height: 460px;
    object-fit: cover;
    display: block;
    margin: 0 auto 20px auto;
    border-radius: 12px;
    border: 3px solid #ffd700;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
}
</style>
