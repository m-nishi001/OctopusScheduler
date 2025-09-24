<template>
	<MainLayout>
		<div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
			<h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">結果画面</h2>
			<p class="text-lg text-gray-700 mb-4">Enterキーでホーム画面へ</p>
			<div v-if="loading">結果取得中...</div>
			<div v-else class="result-list" style="max-height:300px;overflow-y:auto;">
				<ul>
					<li v-for="w in winners" :key="w.name" style="margin-bottom:1em;">
					<span class="winner-name">{{ w.name }}</span>
					</li>
				</ul>
			</div>
		</div>
	</MainLayout>
</template>
<script lang="ts">
import MainLayout from '../common/MainLayout.vue';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ResultService } from '../../../model/applications/ResultService';

export default {
	name: 'Result',
	components: { MainLayout },
	setup() {
		const router = useRouter();
		const winners = ref<{ name: string }[]>([]);
		const loading = ref(true);
		const resultService = new ResultService();

		const fetchResult = async () => {
			// 仮のdrawId（本来は画面遷移時に渡す）
			const drawId = 'latest';
			try {
				const result = await resultService.getResult(drawId);
				// API型に合わせて当選者名のみ表示
				winners.value = result.winners.map((w: { name: string }) => ({ name: w.name }));
			} catch (e) {
				// エラー処理
			} finally {
				loading.value = false;
			}
		};

		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') router.push('/');
		};
		onMounted(() => {
			window.addEventListener('keydown', handleKey);
			fetchResult();
		});
		onUnmounted(() => window.removeEventListener('keydown', handleKey));
		return { winners, loading };
	},
};
</script>
.result-list {
	animation: scrollResult 2s linear;
}
.winner-name {
	font-weight: bold;
	font-size: 1.2em;
}
.prize-rank.high {
	color: #e91e63;
	font-weight: bold;
}
.prize-rank.normal {
	color: #2196f3;
}
.prize-rank.low {
	color: #9e9e9e;
}
@keyframes scrollResult {
	0% { opacity: 0; transform: translateY(30px); }
	100% { opacity: 1; transform: translateY(0); }
}
