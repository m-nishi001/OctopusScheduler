<template>
    <div class="quiz-admin">
        <div class="container">
            <header class="header">
                <h1 class="title">
                    クイズ設定
                </h1>
                <nav class="tabs">
                    <button
                        class="tab"
                        :class="{ active: activeTab === 'quizzes' }"
                        @click="activeTab = 'quizzes'"
                    >
                        クイズ一覧
                    </button>
                    <button
                        class="tab"
                        :class="{ active: activeTab === 'members' }"
                        @click="activeTab = 'members'"
                    >
                        メンバー管理
                    </button>
                </nav>
            </header>

            <QuizList v-if="activeTab === 'quizzes'" />
            <MemberManagement v-else />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import QuizList from './components/quiz-list.vue';
import MemberManagement from './components/member-management.vue';

const activeTab = ref<'quizzes' | 'members'>('quizzes');
</script>

<style scoped>
.quiz-admin {
    min-height: 100vh;
    background-color: #111827;
    color: white;
    font-family: system-ui, sans-serif;
}

.container {
    padding: 1.5rem;
}

.header {
    margin-bottom: 2rem;
}

.title {
    font-size: 1.5rem;
    font-weight: bold;
    text-align: center;
    margin-bottom: 1rem;
    color: white;
}

.tabs {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
}

.tab {
    background-color: #1f2937;
    color: #9ca3af;
    border: 1px solid #374151;
    padding: 0.5rem 1.25rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
}

.tab:hover:not(.active) {
    background-color: #374151;
    color: white;
}

.tab.active {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
}

@media (max-width: 600px) {
    .tabs {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
