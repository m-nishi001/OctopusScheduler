<template>
  <div class="field-block">
    <label class="field-label">{{ label }}</label>
    <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" :placeholder="placeholder" class="admin-input" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '' }
});
const emit = defineEmits(['update:modelValue']);
</script>

<style scoped>
.field-block { min-width: 0; }
.field-label { display: block; margin-bottom: 8px; font-size: 15px; }
.admin-input { width: 100%; }
</style>
