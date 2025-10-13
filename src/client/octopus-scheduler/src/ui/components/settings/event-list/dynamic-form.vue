<template>
  <div class="dynamic-form">
    <template v-for="key in Object.keys(schema.properties)" :key="key">
      <component :is="getComponent('text')" :label="schema.properties[key].title" :modelValue="modelValue[key]"
        @update:modelValue="(val: any) => emitChange(key, val)" />
    </template>
  </div>
</template>

<script setup lang="ts">
import TextInput from '../../common/TextInput.vue';
import DropDown from '../../common/DropDown.vue';

const props = defineProps<{ schema: any; modelValue: Record<string, any> }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: Record<string, any>): void }>();

function emitChange(key: string, value: any) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function getComponent(type: string) {
  switch (type) {
    case 'text': return TextInput;
    case 'dropdown': return DropDown;
    default: return TextInput;
  }
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
