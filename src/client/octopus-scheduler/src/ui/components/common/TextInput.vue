<template>
  <label>
    {{ label }}
    <input :value="modelValue" @input="onInput" type="text" />
  </label>
</template>
<script setup lang="ts">


defineProps<{ label: string; modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

function onInput(e: Event) {
  const target = e.target as HTMLInputElement | null;
  if (target) emit('update:modelValue', target.value);
}
</script>
