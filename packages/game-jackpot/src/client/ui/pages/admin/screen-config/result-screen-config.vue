<template>
    <MediaSelectScreenConfig screen-name="result" setting-name="result-screen-settings" title="最終結果画面設定" :fields="[
        { key: 'resultBgm', label: '最終結果BGM' },
    ]" />
</template>

<script setup lang="ts">
import MediaSelectScreenConfig from './media-select-screen-config.vue';
</script>
