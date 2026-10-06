<template>
    <FormGrid>
        <div class="form-group">
            <label>クイズ名</label>
            <input v-model="currentQuiz.title" type="text" required />
        </div>
        <div class="form-group">
            <label>回答時間 (秒)</label>
            <input v-model.number="currentQuiz.timeLimit" type="number" required />
        </div>
        <div class="form-group ui-form-grid__full">
            <label>クイズ内容</label>
            <textarea v-model="currentQuiz.question" rows="3" required></textarea>
        </div>
        <div class="form-group ui-form-grid__full">
            <label>回答（正解）</label>
            <select v-model.number="currentQuiz.correctNo" :disabled="currentQuiz.options.length === 0">
                <option v-for="(opt, i) in currentQuiz.options" :key="i" :value="i + 1">{{ i + 1 }}: {{ opt.text }}
                </option>
            </select>
        </div>
    </FormGrid>
</template>

<script setup lang="ts">
import { FormGrid } from '@octopus/ui-kit';
import type { QuizDto } from '../../../../control/dto/quiz-dto';

defineProps<{
    currentQuiz: QuizDto;
}>();
</script>
