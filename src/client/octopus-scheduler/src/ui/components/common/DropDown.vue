<template>
  <label>
    {{ label }}
  <select :value="modelValue" @change="onChange">
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
  </label>
</template>
<script setup lang="ts">


defineProps<{ label: string; options: { value: string | number; label: string }[]; modelValue: string | number }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string | number): void }>();

function onChange(e: Event) {
  const target = e.target as HTMLSelectElement | null;
  if (target) emit('update:modelValue', target.value);
}
</script>
