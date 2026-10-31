<template>
    <UiDialog :model-value="modelValue" title="受付QRコード" size="xl" @update:model-value="emit('update:modelValue', $event)">
        <p class="login-qr-sheet__warning" role="note">
            このQRコードは本人専用のログイン用です。他の人に見せたり、写真を共有したりしないでください。
            閉じると表示できなくなります(再発行すると、配布済みのQRコードは使えなくなります)。
        </p>
        <div class="login-qr-sheet" data-testid="login-qr-sheet">
            <figure v-for="card in cards" :key="card.id" class="login-qr-sheet__card">
                <img :src="card.qr" :alt="`${card.name} のログイン用QRコード`" class="login-qr-sheet__qr" />
                <figcaption class="login-qr-sheet__caption">
                    <span class="login-qr-sheet__name">{{ card.name }}</span>
                    <span class="login-qr-sheet__id">ID: {{ card.id }}</span>
                </figcaption>
            </figure>
        </div>
        <template #footer>
            <UiButton @click="emit('update:modelValue', false)">閉じる</UiButton>
            <UiButton variant="primary" @click="print">印刷</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';

export interface LoginQrCard {
    id: string;
    name: string;
    /** QRコード画像(data URL)。 */
    qr: string;
}

defineProps<{ modelValue: boolean; cards: LoginQrCard[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

function print() {
    window.print();
}
</script>

<style scoped>
.login-qr-sheet__warning {
    margin: 0 0 var(--ui-space-3, 12px);
    color: var(--ui-danger, #e5484d);
    font-size: var(--ui-font-sm, 0.875rem);
}

.login-qr-sheet {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--ui-space-3, 12px);
}

.login-qr-sheet__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ui-space-2, 8px);
    margin: 0;
    padding: var(--ui-space-3, 12px);
    background: #fff;
    color: #000;
    border-radius: 8px;
    break-inside: avoid;
}

.login-qr-sheet__qr {
    width: 100%;
    max-width: 160px;
    aspect-ratio: 1 / 1;
    image-rendering: pixelated;
}

.login-qr-sheet__caption {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
}

.login-qr-sheet__name {
    font-weight: 700;
}

.login-qr-sheet__id {
    font-size: var(--ui-font-sm, 0.875rem);
    color: #333;
}
</style>

<style>
/* 印刷時はQRシートだけを紙に出す(ダイアログは body 直下へ移されるため、全体を隠してシートだけ見せる)。 */
@media print {
    body * {
        visibility: hidden;
    }

    .login-qr-sheet,
    .login-qr-sheet * {
        visibility: visible;
    }

    .login-qr-sheet {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        grid-template-columns: repeat(3, 1fr);
    }
}
</style>
