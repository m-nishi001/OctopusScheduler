<template>
    <MediaSelectScreenConfig screen-name="demo" setting-name="demo-screen-settings" title="デモ抽選画面設定" :fields="[
        { key: 'demoBgm', label: 'デモBGM' },
        { key: 'demoSe1', label: 'デモSE1' },
        { key: 'demoSe2', label: 'デモSE2' },
    ]" />
</template>

<script setup lang="ts">
import MediaSelectScreenConfig from './media-select-screen-config.vue';
</script>
