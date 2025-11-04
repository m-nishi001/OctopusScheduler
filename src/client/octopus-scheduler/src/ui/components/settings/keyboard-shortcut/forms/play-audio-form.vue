<template>
    <div class="form-group">
        <label>音声ID:</label>
        <select v-model="formData.audioId">
            <option value="">選択してください</option>
            <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">
                {{ asset.name || asset.id }}
            </option>
        </select>
    </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { container } from 'tsyringe';
import { AssetService } from '../../../../../model/applications/assets/asset-service';
import type { Asset } from '../../../../../model/domains/assets/entity/asset';

interface Props {
    initialData: { audioId?: string };
}

const props = defineProps<Props>();
const emit = defineEmits<{ save: [data: any] }>();

const assetService = container.resolve(AssetService);
const audioAssets = ref<Asset[]>([]);

const formData = reactive({
    audioId: props.initialData.audioId || '',
});

onMounted(async () => {
    try {
        const assets = await assetService.getAssets();
        audioAssets.value = assets.filter(asset => asset.blob.type.startsWith('audio/'));
    } catch (error) {
        console.error('Failed to load audio assets:', error);
    }
});

const save = () => {
    emit('save', { actionType: 'PlayAudioEvent', ...formData });
};

defineExpose({ save });
</script>

<style scoped>
.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 8px;
    border: 1px solid #555;
    border-radius: 4px;
    background: #444;
    color: #fff;
}
</style>