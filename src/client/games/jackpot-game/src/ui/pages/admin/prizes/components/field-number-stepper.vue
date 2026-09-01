<template>
  <div class="field-block">
    <label class="field-label">{{ label }}</label>
    <div class="rank-control">
      <input class="admin-input" :value="modelValue" @input="onInput" type="number" :min="min" />
      <div class="button-group">
        <button type="button" class="rank-btn up" @click="increase">▲</button>
        <button type="button" class="rank-btn down" @click="decrease">▼</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: 0 },
  min: { type: Number, default: 1 }
});
const emit = defineEmits(['update:modelValue']);

const clampMin = (v: number) => Math.max(props.min, v);

const onInput = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value || 0);
  emit('update:modelValue', clampMin(val));
};

const increase = () => emit('update:modelValue', (Number(props.modelValue) || 0) + 1);
const decrease = () => emit('update:modelValue', clampMin((Number(props.modelValue) || 1) - 1));
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

.rank-control {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.admin-input {
  /* Add visual styles to match FieldText (.admin-input) for consistent appearance */
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: #fff;
  font-size: 0.98rem;
  max-width: 100%;
  box-sizing: border-box;
}

.admin-input:focus {
  outline: 2px solid rgba(79, 140, 255, 0.2);
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  flex: 0 0 auto;
}

.rank-btn {
  width: 28px;
  height: 16px;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
  color: #ffffffcc;
  border: 1px solid rgba(255, 255, 255, 0.03);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  padding: 0 6px;
}

.rank-btn.up {
  transform: translateY(-2px);
}

.rank-btn.down {
  transform: translateY(2px);
}

.rank-btn:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.04));
}

/* hide native number input spinners for consistent UI */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type=number] {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: textfield;
}
</style>
