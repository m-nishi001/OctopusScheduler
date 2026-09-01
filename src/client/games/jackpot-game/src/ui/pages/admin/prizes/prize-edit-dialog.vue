<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal-content wide-modal">
            <div class="dialog-grid">
                <div class="dialog-main">
                    <h3>景品詳細</h3>
                    <div class="form-scroll">
                        <PrizeForm ref="formRef" mode="edit" :prize="prize" :image-assets="imageAssets"
                            :audio-assets="audioAssets" :object-url-map="objectUrlMap" @submit="onSubmit" @cancel="closeModal" />
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="footer-right">
                        <button class="save-btn" @click="onFormSubmit">保存</button>
                        <button class="cancel-btn" @click="closeModal">キャンセル</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import PrizeForm from '../../../components/prizes/prize-form.vue';
import type { Asset } from '@model/domains/drive-data/asset-data';
import { PrizeService } from '@model/applications/prize/prize-service';
import { container } from 'tsyringe';
import { ref } from 'vue';

const props = defineProps({
    show: { type: Boolean, required: false },
    prize: { type: Object, required: true },
    imageAssets: { type: Array as () => Asset[], required: true },
    audioAssets: { type: Array as () => Asset[], required: true },
    objectUrlMap: { type: Object, required: true },
});

const emit = defineEmits(['close', 'refresh']);

const closeModal = () => {
    emit('close');
};

const formRef = ref(null as any);

const onFormSubmit = async () => {
    if (formRef && formRef.value && typeof formRef.value.submit === 'function') {
        await formRef.value.submit();
    }
};

const onSubmit = async (formData: any) => {
    try {
        const prizeService = container.resolve(PrizeService);
        await prizeService.updatePrize(props.prize.id, formData);
        emit('refresh');
        closeModal();
    } catch (error) {
        console.error('Failed to update prize:', error);
        // Optionally show user error
    }
};
</script>

<style scoped>
/* Same modal styles */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    z-index: 1100;
}

.modal-content {
    background: linear-gradient(135deg, #232b36 0%, #2a3441 100%);
    color: #fff;
    padding: 28px;
    border-radius: 16px;
    text-align: left;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    max-width: 880px;
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-sizing: border-box;
}

.modal-content.wide-modal {
    width: min(86vw, 1100px);
    margin: 0 auto;
    max-width: 1100px;
    max-height: calc(100vh - 96px);
    display: flex;
    flex-direction: column;
    /* let inner form handle scrolling to avoid double scrollbars */
    overflow: hidden;
}

.dialog-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: start;
    margin-top: 8px;
    min-height: 0;
    flex: 1 1 auto;
}

.dialog-main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    flex: 1 1 auto;
    min-height: 0;
}

.form-scroll {
    flex: 1 1 auto;
    overflow-y: auto;
    min-height: 0;
    /* allow flex children to shrink in Firefox/Chrome */
    /* provide extra space so prize-form's sticky actions are not obscured by the modal footer */
    padding-bottom: 96px;
    /* breathing room for footer */
    /* keep a consistent margin to the right of the vertical scrollbar */
    padding-right: 12px;
    /* reserve gutter for scrollbars to avoid layout jumps / variable gap */
    scrollbar-gutter: stable both-edges;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.modal-footer .save-btn,
.modal-footer .cancel-btn {
    padding: 10px 18px;
    border-radius: 8px;
    background: linear-gradient(180deg, #1f2a31, #27313a);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.04);
    cursor: pointer;
}
</style>
