<template>
  <div class="asset-type-tabs">
    <button v-for="type in assetTypes" :key="type" :class="{ active: type === selectedType }" @click="$emit('update:type', type)">
      {{ type }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const assetTypes = ['Audio', 'Image', 'Movie'];
const props = defineProps<{ type: string }>();
const emit = defineEmits(['update:type']);
const selectedType = props.type;
</script>

<style scoped>
.asset-type-tabs {
  margin-bottom: 1em;
}
button {
  margin-right: 0.5em;
  padding: 0.5em 1.2em;
  font-size: 1em;
}
button.active {
  background: #42b883;
  color: white;
}
</style>
