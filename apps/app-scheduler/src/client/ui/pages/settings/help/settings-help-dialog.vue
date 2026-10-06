<template>
    <UiDialog :model-value="modelValue" title="設定画面の使い方" size="lg" @update:model-value="emit('update:modelValue', $event)">
        <section class="help-section">
            <h3>全体の流れ</h3>
            <ol><li v-for="t in HELP_FLOW" :key="t">{{ t }}</li></ol>
        </section>
        <section class="help-section">
            <h3>ショートカットのルール</h3>
            <ul><li v-for="t in HELP_SHORTCUT_RULES" :key="t">{{ t }}</li></ul>
        </section>
        <section class="help-section">
            <h3>クイズ画面の操作</h3>
            <ul><li v-for="t in HELP_QUIZ_NOTES" :key="t">{{ t }}</li></ul>
        </section>
        <template #footer>
            <UiButton variant="primary" @click="emit('update:modelValue', false)">閉じる</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { HELP_FLOW, HELP_QUIZ_NOTES, HELP_SHORTCUT_RULES } from './help-content';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<style scoped>
.help-section + .help-section { margin-top: var(--ui-space-4); }
h3 { font-size: var(--ui-font-md, 1rem); margin: 0 0 var(--ui-space-2); }
ol, ul { margin: 0; padding-left: 1.4em; line-height: 1.7; }
</style>
