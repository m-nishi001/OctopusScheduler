<template>
    <MediaSelectScreenConfig screen-name="result" setting-name="result-screen-settings" title="最終結果画面設定" :fields="[
        { key: 'resultBgm', label: '最終結果BGM' },
        { key: 'resultSe1', label: '最終結果SE1' },
        { key: 'resultSe2', label: '最終結果SE2' },
    ]" />
</template>

<script setup lang="ts">
import MediaSelectScreenConfig from './media-select-screen-config.vue';
</script>
