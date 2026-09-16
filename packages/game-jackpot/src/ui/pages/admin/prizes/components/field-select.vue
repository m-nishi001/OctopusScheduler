<template>
  <div class="field-block">
    <label class="field-label">{{ label }}</label>
    <CustomSelect class="admin-input" :modelValue="modelValue" :options="options" :allowEmpty="allowEmpty"
      @update:modelValue="$emit('update:modelValue', $event)" />
  </div>
</template>

<script setup lang="ts">
import CustomSelect from './custom-select.vue';
const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array as () => { value: string | number, label: string }[], default: () => [] },
  allowEmpty: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);
</script>

<!-- combined script above, removed duplicate import -->

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
  border: none;
  background: #232b36;
  /* match modal background */
  color: #fff;
  font-size: 0.98rem;
}

.admin-input:focus {
  outline: 2px solid #4f8cff;
}

/* Make <option> list darker on supporting browsers (Firefox, modern browsers) */
.admin-input option {
  background: #232b36;
  color: #fff;
}

/* Improve dropdown layering inside modal */
.admin-input {
  position: relative;
  z-index: 1200;
}
</style>
