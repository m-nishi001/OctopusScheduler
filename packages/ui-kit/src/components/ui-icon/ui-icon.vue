<template>
    <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path v-for="(d, i) in paths" :key="i" :d="d" />
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { UI_ICON_PATHS, type UiIconName } from './icons';

const props = defineProps<{ name: UiIconName }>();
const paths = computed(() => UI_ICON_PATHS[props.name] ?? []);
</script>

<style scoped>
.ui-icon {
    width: var(--ui-icon-size, 18px);
    height: var(--ui-icon-size, 18px);
    flex: none;
}
</style>
