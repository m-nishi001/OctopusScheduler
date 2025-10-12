<template>
    <DescriptionContent />
</template>

<script lang="ts">
import DescriptionContent from './description-screen-config.vue';

export default {
    name: 'DescriptionView',
    components: { DescriptionContent },
};
</script>

<style scoped>
/* intentionally empty: presentation handled by DescriptionContent */
</style>