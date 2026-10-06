<template>
    <UiDialog :model-value="visible" title="抽選テスト" size="lg" nested :close-on-overlay="false" :persistent="running"
        @close="close">
            <div v-if="!results" class="test-section">
                <div class="input-group">
                    <label for="memberCount">メンバー数:</label>
                    <input id="memberCount" v-model.number="memberCount" type="number" min="1" max="100" />
                </div>
                <div class="input-group">
                    <label for="prizeCount">景品数:</label>
                    <input id="prizeCount" v-model.number="prizeCount" type="number" min="1" max="100" />
                </div>
                <UiButton variant="primary" :loading="running" :disabled="memberCount < 1 || prizeCount < 1"
                    @click="runDrawTest">
                    {{ running ? '実行中...' : '抽選テスト実行' }}
                </UiButton>
            </div>
            <div v-else class="results-section">
                <h4>テスト結果</h4>
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Draw ID</th>
                            <th>Member</th>
                            <th>Prize</th>
                            <th>Prize Weight</th>
                            <th>Kakuhen</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="result in results" :key="result.drawId">
                            <td>{{ result.drawId }}</td>
                            <td>{{ result.wonMember?.name || '' }}</td>
                            <td>{{ result.wonPrize?.name || '' }}</td>
                            <td>{{ result.wonPrize?.weight || '' }}</td>
                            <td>{{ result.isKakuhen ? 'Yes' : 'No' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        <template v-if="results" #footer>
            <UiButton icon="download" @click="downloadCsv">CSVダウンロード</UiButton>
            <UiButton variant="primary" @click="close">閉じる</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { ref } from 'vue';
import { container } from 'tsyringe';
import { DrawSimulationService } from '@control/draw/draw-simulation-service';
import type { DrawResultDto } from '@control/draw/dto/draw-result-dto';

interface Props {
    visible: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
    close: [];
}>();

const simulationService = container.resolve(DrawSimulationService) as DrawSimulationService;
const running = ref(false);
const results = ref<DrawResultDto[] | null>(null);
const memberCount = ref(10);
const prizeCount = ref(10);

const runDrawTest = async () => {
    running.value = true;
    results.value = null;
    try {
        const { results: simResults } = await simulationService.runSimulation(memberCount.value, prizeCount.value);
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
    const csv = simulationService.generateCsv(results.value);
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
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 4px;
    background: #1a1a1a;
    color: var(--ui-text, #fff);
    text-align: center;
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
    border: 1px solid var(--ui-border, #3a4048);
    text-align: left;
}

.results-table th {
    background: #1a1a1a;
    font-weight: bold;
}
</style>