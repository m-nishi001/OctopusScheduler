<template>
    <section v-if="quiz.quiz.value" class="pp-card pp-quiz" data-testid="quiz-panel" aria-live="polite">
        <p class="pp-quiz__label">クイズ</p>
        <h2 v-if="quiz.quiz.value.title" class="pp-quiz__title">{{ quiz.quiz.value.title }}</h2>

        <template v-if="quiz.quiz.value.page === 'play'">
            <p class="pp-quiz__question">{{ quiz.quiz.value.question }}</p>
            <p v-if="quiz.quiz.value.phase === 'answering' && quiz.remainingSec.value !== null" class="pp-quiz__timer" data-testid="quiz-timer">
                残り {{ quiz.remainingSec.value }} 秒
            </p>
            <div class="pp-quiz__options" role="group" aria-label="選択肢">
                <button v-for="o in quiz.quiz.value.options" :key="o.no" type="button" class="pp-quiz__option"
                    :class="{ 'is-chosen': quiz.myAnswer.value === o.no }" :style="{ '--option-color': o.color || '#3b82f6' }"
                    :disabled="!quiz.canAnswer.value" :aria-pressed="quiz.myAnswer.value === o.no" @click="quiz.answer(o.no)">
                    <span class="pp-quiz__no">{{ o.no }}</span>{{ o.text }}
                </button>
            </div>
            <p v-if="quiz.myAnswer.value !== null" class="pp-quiz__answered" data-testid="quiz-answered">
                回答しました(選択: {{ quiz.optionLabel(quiz.myAnswer.value) }})
            </p>
            <p v-else-if="quiz.quiz.value.phase === 'closed' || (quiz.remainingSec.value !== null && quiz.remainingSec.value <= 0)"
                class="pp-muted" data-testid="quiz-closed">
                受付は終了しました
            </p>
            <p v-if="quiz.message.value" class="pp-quiz__message" role="alert">{{ quiz.message.value }}</p>
        </template>

        <template v-else-if="quiz.quiz.value.page === 'answer'">
            <p class="pp-quiz__question">{{ quiz.quiz.value.question }}</p>
            <p class="pp-quiz__correct" data-testid="quiz-correct">正解: {{ quiz.correctLabel.value }}</p>
            <p v-if="quiz.myAnswer.value !== null" class="pp-quiz__verdict"
                :class="quiz.myAnswer.value === quiz.quiz.value.correctNo ? 'is-correct' : 'is-wrong'" data-testid="quiz-verdict">
                {{ quiz.verdictText.value }}
            </p>
            <p v-else class="pp-muted">あなたは回答していません</p>
        </template>

        <template v-else-if="quiz.quiz.value.page === 'result'">
            <p class="pp-muted">結果発表中です。会場の画面をご覧ください。</p>
            <RouterLink to="/p/results" class="pp-button pp-button--ghost pp-quiz__results" data-testid="quiz-results-link">順位を見る</RouterLink>
        </template>
        <p v-else class="pp-muted">クイズが始まります。しばらくお待ちください。</p>
    </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useQuizContext } from '../../model/use-quiz';

const quiz = useQuizContext();
</script>

<style scoped>
.pp-quiz {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.pp-quiz__label {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--pp-gold);
}

.pp-quiz__title {
    margin: 0;
    font-size: 1rem;
    opacity: 0.85;
}

.pp-quiz__question {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 800;
    line-height: 1.5;
    word-break: break-word;
}

.pp-quiz__timer {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    color: var(--pp-gold);
}

.pp-quiz__options {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pp-quiz__option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 12px 16px;
    border-radius: 14px;
    border: 3px solid var(--option-color);
    background: color-mix(in srgb, var(--option-color) 25%, #1a0a0e);
    color: #fff;
    font: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
}

.pp-quiz__option:disabled {
    opacity: 0.55;
    cursor: default;
}

.pp-quiz__option.is-chosen {
    opacity: 1;
    background: var(--option-color);
    box-shadow: 0 0 0 3px #fff;
}

.pp-quiz__no {
    display: inline-flex;
    width: 1.8em;
    height: 1.8em;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
}

.pp-quiz__answered {
    margin: 0;
    font-weight: 800;
    color: var(--pp-ok);
}

.pp-quiz__message {
    margin: 0;
    color: var(--pp-danger);
}

.pp-quiz__correct {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 900;
    color: var(--pp-gold);
}

.pp-quiz__verdict {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 900;
}

.pp-quiz__verdict.is-correct {
    color: var(--pp-ok);
}

.pp-quiz__verdict.is-wrong {
    color: var(--pp-danger);
}

.pp-quiz__results {
    margin-top: 12px;
}
</style>
