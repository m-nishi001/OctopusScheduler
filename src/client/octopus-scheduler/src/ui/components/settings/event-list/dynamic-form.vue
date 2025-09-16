<template>
  <div class="dynamic-form">
    <template v-if="schema">
      <template v-for="([key, prop]) in Object.entries(schema.properties)" :key="key">
        <label>
          {{ (prop as any).title }}:
          <template v-if="(prop as any).type === 'string' && (prop as any).oneOf && (prop as any).oneOf.length">
            <select :value="modelValue[key]"
              @change="e => { const target = e.target as HTMLSelectElement | null; if (target) emitChange(key, String(target.value)); }">
              <option v-for="opt in (prop as any).oneOf" :key="opt.const" :value="opt.const">
                {{ opt.title }}
              </option>
            </select>
          </template>
          <template v-else>
            <input :value="modelValue[key]"
              @input="e => { const target = e.target as HTMLInputElement | null; if (target) emitChange(key, String(target.value)); }"
              type="text" />
          </template>
        </label>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
  schema: any;
  modelValue: Record<string, any>;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: Record<string, any>): void }>();

function emitChange(key: string, value: any) {
  const newValue = { ...props.modelValue, [key]: value };
  emit('update:modelValue', newValue);
}
</script>

<style scoped>
.dynamic-form label {
  display: flex;
  align-items: center;
  gap: 0.7em;
  margin-bottom: 0.7em;
  color: #fff;
}
.dynamic-form input,
.dynamic-form select {
  background: #333;
  color: #fff;
  border: 1px solid #666;
  padding: 0.4em 0.8em;
  border-radius: 6px;
  margin-bottom: 0.7em;
}
</style>
