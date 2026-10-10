<template>
    <div class="session-qr">
        <img v-if="qrUrl" :src="qrUrl" alt="参加用QRコード" class="session-qr__image" />
        <div v-else class="session-qr__placeholder" aria-hidden="true" />
        <div class="session-qr__code" aria-label="参加コード">{{ code }}</div>
        <p v-if="error" class="session-qr__error" role="alert">{{ error }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { SessionAdminRepository } from '@octopus/session-hub';

const props = defineProps<{ code: string; repository: Pick<SessionAdminRepository, 'portalUrl'> }>();

const url = ref('');
const error = ref('');

async function load() {
    error.value = '';
    try {
        url.value = await props.repository.portalUrl(props.code);
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    }
}

onMounted(load);
watch(() => props.code, load);

// 既存のクイズ参加QRと同じ外部QR生成サービスを使う(参加URLのみを送る)。
const qrUrl = computed(() =>
    url.value ? `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=2&data=${encodeURIComponent(url.value)}` : '',
);
</script>

<style scoped>
.session-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.session-qr__image,
.session-qr__placeholder {
    width: min(60vmin, 420px);
    aspect-ratio: 1 / 1;
    background: #fff;
    border-radius: 12px;
}

.session-qr__code {
    font-size: clamp(2rem, 8vmin, 4.5rem);
    font-weight: 800;
    letter-spacing: 0.3em;
    font-variant-numeric: tabular-nums;
}

.session-qr__error {
    color: #ff8a80;
    margin: 0;
}
</style>
