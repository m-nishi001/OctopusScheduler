<template>
	<MainLayout>
		<div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
			<h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">結果画面</h2>
			<p class="text-lg text-gray-700 mb-4">Enterキーでホーム画面へ</p>
			<div v-if="loading">結果取得中...</div>
			<div v-else class="result-list" style="max-height:300px;overflow-y:auto;">
				<ul>
					<li v-for="w in winners" :key="w.member.id" style="margin-bottom:1em;">
						<span class="winner-name">{{ w.member.name }}</span>
					</li>
				</ul>
			</div>
		</div>
	</MainLayout>
</template>
<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { DrawResultRepository } from '../../../model/infrastructures/repositories/draw-result-repository';
import type { DrawResultDto } from '../../../model/applications/draw-result/dto/draw-result-dto';
import type { IScreenConfig } from '../../../model/domains/screen-config/i-screen-config';
import { ScreenConfigService } from '../../../model/applications/screen-config/screen-config-service';
import { container } from 'tsyringe';

export default {
	name: 'Result',
	components: { MainLayout },
	setup() {
		const router = useRouter();
		const winners = ref<DrawResultDto[]>([]);
		const loading = ref(true);
		const drawResultRepo = container.resolve(DrawResultRepository);
		const screenConfig = ref<IScreenConfig | null>(null);
		const screenConfigService = container.resolve(ScreenConfigService);
		onMounted(async () => {
			screenConfig.value = await screenConfigService.fetchScreenConfig('result');
			try {
				const results = await drawResultRepo.getDrawResults();
				winners.value = results;
			} finally {
				loading.value = false;
			}
			window.addEventListener('keydown', handleKey);
		});

		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') router.push('/');
		};
		onUnmounted(() => window.removeEventListener('keydown', handleKey));
		return { winners, loading, screenConfig };
	},
};
</script>
<style scoped>
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
	0% {
		opacity: 0;
		transform: translateY(30px);
	}

	100% {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
