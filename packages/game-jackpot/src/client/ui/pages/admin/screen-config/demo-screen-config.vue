<template>
    <MediaSelectScreenConfig screen-name="demo" setting-name="demo-screen-settings" title="デモ抽選画面設定" :fields="[
        { key: 'demoBgm', label: 'デモBGM' },
        { key: 'demoDrawSe', label: 'デモ抽選SE' },
    ]" />
</template>

<script setup lang="ts">
import MediaSelectScreenConfig from './media-select-screen-config.vue';
</script>
