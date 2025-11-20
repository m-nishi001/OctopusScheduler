<template>
    <div class="bgm-field">
        <div class="bgm-controls">
            <label class="field-label">{{ label }}</label>
            <div class="bgm-mode">
                <div class="bgm-radio-group">
                    <label><input type="radio" :name="label + '-mode'" :checked="mode === 'upload'" value="upload"
                            @change="$emit('update:mode', $event.target.value)" /> アップロード</label>
                    <label><input type="radio" :name="label + '-mode'" :checked="mode === 'select'" value="select"
                            @change="$emit('update:mode', $event.target.value)" /> 既存から選択</label>
                </div>
                <div class="bgm-select-group">
                    <CustomSelect v-if="mode === 'select'" :modelValue="assetId"
                        :options="assets.map(a => ({ value: a.id, label: a.name }))" :allowEmpty="true"
                        @update:modelValue="$emit('update:assetId', $event)" />
                    <input v-if="mode === 'upload'" type="file" @change="onFileChange" accept="audio/*"
                        class="admin-input" />
                    <span v-if="mode === 'upload' && filename" class="file-name">{{ filename }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import CustomSelect from './custom-select.vue';
import type { Asset } from '@model/domains/drive-data/asset-data';

defineProps<{
    label: string;
    mode: string;
    assetId: string;
    filename: string;
    assets: Asset[];
}>();

const emit = defineEmits<{
    'update:mode': [value: string];
    'update:assetId': [value: string];
    'file-change': [event: Event];
}>();

const onFileChange = (event: Event) => {
    emit('file-change', event);
};
</script>

<style scoped>
/* Styles copied from prize-edit-dialog.vue */
.bgm-field {
    display: flex;
    gap: 12px;
    align-items: flex-start;
}

.bgm-controls {
    flex: 1 1 auto;
}

.field-label {
    color: #dbeeff;
    font-weight: 600;
    font-size: 14px;
}

.admin-input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 15px;
    color: #fff;
    transition: box-shadow .15s ease, border-color .15s ease;
}

.admin-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45) inset, 0 0 0 3px rgba(88, 156, 255, 0.06);
}

.bgm-mode {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.bgm-radio-group {
    display: flex;
    gap: 12px;
    flex-wrap: nowrap;
    align-items: center;
    overflow: visible;
}

.bgm-radio-group label {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-right: 8px;
}

.bgm-select-group {
    display: block;
}

.bgm-select-group .admin-input {
    width: 100%;
    min-width: 0;
}

.bgm-select-group input[type="file"] {
    max-width: 170px;
    width: auto;
    display: inline-block;
}

.bgm-select-group .file-name {
    max-width: calc(100% - 180px);
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
}
</style>