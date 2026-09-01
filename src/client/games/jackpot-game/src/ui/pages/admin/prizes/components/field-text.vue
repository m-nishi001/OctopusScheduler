<template>
  <div class="field-block">
    <label class="field-label">{{ label }}</label>
    <input :value="modelValue" @input="onInput" :placeholder="placeholder" class="admin-input" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '' }
});
const emit = defineEmits(['update:modelValue']);
const onInput = (event: Event) => {
  const v = (event.target as HTMLInputElement | null)?.value;
  emit('update:modelValue', v);
};
</script>

<style scoped>
.field-block {
  min-width: 0;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 15px;
}

.admin-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: #fff;
  font-size: 0.98rem;
  box-sizing: border-box;
}

.admin-input:focus {
  outline: 2px solid rgba(79, 140, 255, 0.2);
}
</style>
