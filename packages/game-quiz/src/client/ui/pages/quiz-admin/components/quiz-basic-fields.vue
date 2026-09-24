<template>
    <div class="form-grid">
        <div class="form-group">
            <label class="form-label">クイズ名</label>
            <input v-model="currentQuiz.title" type="text" class="form-input" required />
        </div>
        <div class="form-group">
            <label class="form-label">回答時間 (秒)</label>
            <input v-model.number="currentQuiz.timeLimit" type="number" class="form-input" required />
        </div>
    </div>
    <div class="form-group">
        <label class="form-label">クイズ内容</label>
        <textarea v-model="currentQuiz.question" class="form-textarea" rows="3" required></textarea>
    </div>
    <div class="form-group">
        <label class="form-label">回答（正解）</label>
        <select v-model.number="currentQuiz.correctNo" class="form-input"
            :disabled="currentQuiz.options.length === 0">
            <option v-for="(opt, i) in currentQuiz.options" :key="i" :value="i + 1">{{ i + 1 }}: {{ opt.text
                }}
            </option>
        </select>
    </div>
</template>

<script setup lang="ts">
import type { QuizDto } from '../../../../control/dto/quiz-dto';

defineProps<{
    currentQuiz: QuizDto;
}>();
</script>

<style scoped>
.form-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2.75rem;
    /* gap-11 approx */
}

@media (min-width: 768px) {
    .form-grid {
        grid-template-columns: 1fr 1fr;
        /* md:grid-cols-2 */
    }
}

.form-group {
    display: flex;
    flex-direction: column;
}

.form-label {
    display: block;
    font-size: 0.875rem;
    /* text-sm */
    font-weight: bold;
    margin-bottom: 0.5rem;
    /* mb-2 */
    color: #d1d5db;
    /* text-gray-300 */
}

.form-input,
.form-textarea {
    width: 100%;
    padding: 0.5rem;
    /* p-2 */
    border: 1px solid #4b5563;
    /* border-gray-600 */
    border-radius: 0.25rem;
    /* rounded */
    font-family: inherit;
    background-color: #374151;
    /* bg-gray-700 */
    color: white;
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    box-shadow: 0 0 0 2px #3b82f6;
    /* focus:ring-2 focus:ring-blue-500 */
}

.form-textarea {
    resize: vertical;
}
</style>
