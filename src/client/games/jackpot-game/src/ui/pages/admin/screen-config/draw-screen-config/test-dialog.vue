<template>
    <div v-if="visible" class="modal-overlay">
        <div class="modal-content" @click.stop>
            <h3>抽選テスト</h3>
            <div v-if="!results" class="test-section">
                <div class="input-group">
                    <label for="memberCount">メンバー数:</label>
                    <input id="memberCount" v-model.number="memberCount" type="number" min="1" max="100" />
                </div>
                <div class="input-group">
                    <label for="prizeCount">景品数:</label>
                    <input id="prizeCount" v-model.number="prizeCount" type="number" min="1" max="100" />
                </div>
                <button @click="runDrawTest" :disabled="running || memberCount < 1 || prizeCount < 1" class="test-btn">
                    {{ running ? '実行中...' : '抽選テスト実行' }}
                </button>
                <div v-if="running" class="spinner"></div>
            </div>
            <div v-else class="results-section">
                <h4>テスト結果</h4>
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Draw ID</th>
                            <th>Member</th>
                            <th>Prize</th>
                            <th>Prize Rank</th>
                            <th>Kakuhen</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="result in results" :key="result.drawId">
                            <td>{{ result.drawId }}</td>
                            <td>{{ result.wonMember?.name || '' }}</td>
                            <td>{{ result.wonPrize?.name || '' }}</td>
                            <td>{{ result.wonPrize?.rank || '' }}</td>
                            <td>{{ result.isKakuhen ? 'Yes' : 'No' }}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="actions">
                    <button @click="downloadCsv" class="csv-btn">CSVダウンロード</button>
                    <button @click="close" class="close-btn">閉じる</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { container } from 'tsyringe';
import { DrawTestService } from '@model/applications/draw/draw-test-service';
import type { DrawResultDto } from '@model/applications/draw/dto/draw-result-dto';

interface Props {
    visible: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
    close: [];
}>();

const testService = container.resolve(DrawTestService) as DrawTestService;
const running = ref(false);
const results = ref<DrawResultDto[] | null>(null);
const memberCount = ref(10);
const prizeCount = ref(10);

const runDrawTest = async () => {
    running.value = true;
    results.value = null;
    try {
        const { results: simResults } = await testService.runSimulation(memberCount.value, prizeCount.value);
        results.value = simResults;
    } catch (error) {
        console.error('Test failed:', error);
        alert('テスト実行中にエラーが発生しました。');
    } finally {
        running.value = false;
    }
};

const downloadCsv = () => {
    if (!results.value) return;
    const csv = testService.generateCsv(results.value);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'draw-test-results.csv';
    a.click();
    URL.revokeObjectURL(url);
};

const close = () => {
    results.value = null;
    emit('close');
};
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: #232b36;
    color: #fff;
    padding: 28px;
    border-radius: 10px;
    max-width: 90%;
    max-height: 90%;
    overflow-y: auto;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
}

.test-section {
    text-align: center;
}

.input-group {
    margin-bottom: 16px;
}

.input-group label {
    display: block;
    margin-bottom: 4px;
    font-weight: bold;
}

.input-group input {
    width: 100px;
    padding: 8px;
    border: 1px solid #444;
    border-radius: 4px;
    background: #1a1a1a;
    color: #fff;
    text-align: center;
}

.test-btn {
    padding: 12px 24px;
    background: #4f8cff;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
}

.test-btn:hover:not(:disabled) {
    background: #3a7bd5;
}

.test-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.spinner {
    margin: 16px auto;
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4f8cff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.results-section h4 {
    margin-bottom: 16px;
}

.results-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
}

.results-table th,
.results-table td {
    padding: 8px 12px;
    border: 1px solid #444;
    text-align: left;
}

.results-table th {
    background: #1a1a1a;
    font-weight: bold;
}

.actions {
    display: flex;
    gap: 12px;
    justify-content: center;
}

.csv-btn,
.close-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
}

.csv-btn {
    background: #28a745;
    color: #fff;
}

.csv-btn:hover {
    background: #218838;
}

.close-btn {
    background: #dc3545;
    color: #fff;
}

.close-btn:hover {
    background: #c82333;
}
</style>