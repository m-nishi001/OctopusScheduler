<template>
	<MainLayout>
		<div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
			<h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">結果画面</h2>
			<p class="text-lg text-gray-700 mb-4">Enterキーでホーム画面へ</p>
			<div v-if="loading">結果取得中...</div>
			<div v-else class="result-list" style="max-height:300px;overflow-y:auto;">
				<ul>
					  <li v-for="w in winners" :key="w.memberId" style="margin-bottom:1em;">
					  <span class="winner-name">{{ getMemberName(w.memberId) }}</span>
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
import type { LotteryResultDto } from '../../../model/applications/dto/LotteryResultDto';
import type { MemberDto } from '../../../model/applications/dto/MemberDto';
import type { ScreenConfig } from '../../../model/domains/screen-config/ScreenConfig';
import { ScreenConfigService } from '../../../model/applications/ScreenConfigService';

export default {
	name: 'Result',
	components: { MainLayout },
	setup() {
		const router = useRouter();
		const winners = ref<LotteryResultDto[]>([]);
		const members = ref<MemberDto[]>([]);
		const loading = ref(true);
		const resultService = new ResultService();

		// ScreenConfigServiceから取得
		const screenConfig = ref<ScreenConfig | null>(null);
		const screenConfigService = new ScreenConfigService();
		onMounted(async () => {
			screenConfig.value = await screenConfigService.fetchScreenConfig('result');
			fetchResult();
		});

		const fetchResult = async () => {
			// 仮のdrawId（本来は画面遷移時に渡す）
			const drawId = 'latest';
			try {
						const result = await resultService.getResult(drawId);
						winners.value = result.results;
						// 仮: メンバー情報を取得するAPI呼び出し（本来はServiceから取得）
						members.value = [
							{ id: '1', name: '山田太郎', order: 1 },
							{ id: '2', name: '佐藤花子', order: 2 },
							{ id: '3', name: '鈴木一郎', order: 3 }
						];
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
			// メンバー名取得関数
			const getMemberName = (memberId: string) => {
				const member = members.value.find(m => m.id === memberId);
				return member ? member.name : memberId;
			};
			return { winners, loading, screenConfig, getMemberName };
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
