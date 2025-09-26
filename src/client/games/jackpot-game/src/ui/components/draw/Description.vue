<template>
	<MainLayout>
		<div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
			<h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">説明画面</h2>
			<p class="text-lg text-gray-700 mb-4">Enterキーでデモ抽選画面へ</p>
		</div>
	</MainLayout>
</template>
<script lang="ts">
import MainLayout from '../common/MainLayout.vue';
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import type { ScreenConfig } from '../../../model/domains/screen-config/ScreenConfig';
export default {
	name: 'Description',
	components: { MainLayout },
	setup() {
		const router = useRouter();
		// 仮のScreenConfig（設計書準拠）
		const screenConfig: ScreenConfig = {
			type: 'description',
			bgmAssetId: 'asset_bgm_description',
			seAssetIds: ['asset_se_slide'],
			backgroundStyle: 'linear-gradient(to right, #fef08a, #a5b4fc)',
			elements: [
				{ id: 'title', type: 'text', content: '説明画面' },
				{ id: 'slide', type: 'modal', content: 'Enterキーでデモ抽選画面へ' }
			],
			animationSettings: {
				type: 'slide',
				duration: 1.5,
				params: { direction: 'right' }
			}
		};
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') router.push('/demo-draw');
		};
		onMounted(() => window.addEventListener('keydown', handleKey));
		onUnmounted(() => window.removeEventListener('keydown', handleKey));
		return { screenConfig };
	},
};
</script>
