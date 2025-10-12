<template>
	<MainLayout>
		<div class="description-screen">
			<div class="description-content">
				<h2 class="description-title">説明画面</h2>
				<p class="description-text">ここにゲームの説明を記載します。</p>
				<p class="description-text">Enterキーを押して次へ進んでください。</p>
			</div>
		</div>
	</MainLayout>
</template>
<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import type { IScreenConfig } from '../../../model/domains/screen-config/i-screen-config';
import { ScreenConfigRepository } from '../../../model/infrastructures/repositories/screen-config-repository';
import { AssetRepository } from '../../../model/infrastructures/repositories/asset-repository';
import { container } from 'tsyringe';
export default {
	name: 'Description',
	components: { MainLayout },
	setup() {
		const router = useRouter();
		// ScreenConfigRepositoryから取得
		const screenConfig = ref<IScreenConfig | null>(null);
		const screenConfigRepo = container.resolve(ScreenConfigRepository);
		onMounted(async () => {
			screenConfig.value = await screenConfigRepo.getScreenConfigById('description');
			setTimeout(playBGM, 1200);
		});

		// BGM/SE制御
		const bgmAudio = ref<HTMLAudioElement | null>(null);
		const playBGM = async () => {
			if (!screenConfig.value) return;
			const descriptionConfig = screenConfig.value as any; // DescriptionScreenConfig
			if (!descriptionConfig.descriptionBgm) return;
			const assetRepo = container.resolve(AssetRepository);
			const asset = await assetRepo.getAssetById(descriptionConfig.descriptionBgm);
			if (!asset) return;
			if (!bgmAudio.value) {
				bgmAudio.value = new Audio(asset.dataUrl);
				bgmAudio.value.loop = true;
			}
			bgmAudio.value.play();
		};

		// Enterキーで次へ
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				router.push('/demo-draw');
			}
		};
		onMounted(() => window.addEventListener('keydown', handleKey));
		onUnmounted(() => window.removeEventListener('keydown', handleKey));

		return { screenConfig };
	},
};
</script>

<style scoped>
.description-screen {
	width: 100vw;
	height: 100vh;
	background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	position: relative;
	overflow: hidden;
}

.description-screen::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
		radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%);
	pointer-events: none;
}

.description-content {
	text-align: center;
	color: #ffffff;
	z-index: 1;
}

.description-title {
	font-size: 3rem;
	font-weight: 300;
	color: #ffffff;
	text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
	margin-bottom: 2rem;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.description-text {
	font-size: 1.5rem;
	color: #e0e0e0;
	line-height: 1.6;
	margin-bottom: 1rem;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
</style>
