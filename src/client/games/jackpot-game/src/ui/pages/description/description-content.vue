<template>
	<MainLayout>
		<div class="description-screen">
			<div class="slide-container">
				<transition-group name="slide-transition" tag="div">
					<div v-if="currentSlide" :key="currentSlide.id" class="slide-content">
						<template v-if="currentSlide.type === 'text'">
							<div v-if="isHtml(currentSlide.content)" class="slide-html" v-html="currentSlide.content">
							</div>
							<div v-else class="slide-text">{{ currentSlide.content }}</div>
						</template>
						<template v-if="currentSlide.type === 'image'">
							<img :src="currentSlide.assetUrl" class="slide-image" />
						</template>
						<template v-if="currentSlide.type === 'modal'">
							<div class="slide-modal">{{ currentSlide.content }}</div>
						</template>
					</div>
				</transition-group>
			</div>
			<div class="navigation-hint">
				<span class="hint-text">Press ENTER to continue</span>
				<div class="progress-dots">
					<span v-for="(element, index) in elements" :key="element.id" class="dot"
						:class="{ active: index === slideIndex }"></span>
				</div>
			</div>
		</div>
	</MainLayout>
</template>
<script lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import type { ScreenElement } from '../../../model/domains/screen-config/IScreenConfig';
import { DescriptionScreenConfig } from '../../../model/domains/screen-config/DescriptionScreenConfig';
import { ScreenConfigRepository } from '../../../model/infrastructures/repositories/screen-config-repository';
import { container } from 'tsyringe';
export default {
	name: 'Description',
	components: { MainLayout },
	setup() {
		const router = useRouter();
		// ScreenConfigRepositoryから取得
		const screenConfig = ref<DescriptionScreenConfig | null>(null);
		const screenConfigRepo = container.resolve(ScreenConfigRepository);
		const slideIndex = ref(0);
		const currentSlide = ref<ScreenElement | null>(null);

		// 固定のスライド要素
		const elements = ref<ScreenElement[]>([
			{
				id: 'slide1',
				type: 'text',
				content: 'Welcome to the Jackpot Game!\n\nThis is an exciting adventure where you can win amazing prizes.',
			},
			{
				id: 'slide2',
				type: 'image',
				assetId: 'description-image-1',
				assetUrl: '/assets/images/description1.png', // 仮定
			},
			{
				id: 'slide3',
				type: 'text',
				content: 'Follow the instructions carefully and enjoy the game!',
			},
		]);

		const bgmAssetUrl = computed(() => (screenConfig.value as DescriptionScreenConfig)?.descriptionBgm);
		const seAssetUrls = computed(() => [
			(screenConfig.value as DescriptionScreenConfig)?.descriptionSe1,
			(screenConfig.value as DescriptionScreenConfig)?.descriptionSe2,
		].filter(Boolean));

		onMounted(async () => {
			screenConfig.value = await screenConfigRepo.getScreenConfigById('description') as DescriptionScreenConfig;
			currentSlide.value = elements.value[0] ?? null;
			setTimeout(playBGM, 1200);
		});

		// BGM/SE制御
		const bgmAudio = ref<HTMLAudioElement | null>(null);
		const playBGM = () => {
			if (!bgmAssetUrl.value) return;
			if (!bgmAudio.value) {
				bgmAudio.value = new Audio(bgmAssetUrl.value);
				bgmAudio.value.loop = true;
			}
			bgmAudio.value.play();
		};

		const playSE = (seType: string) => {
			if (!seAssetUrls.value) return;
			const assetUrl = seAssetUrls.value.find((url: string) => url.includes(seType));
			if (!assetUrl) return;
			const seAudio = new Audio(assetUrl);
			seAudio.play();
		};

		// スライド管理
		const nextSlide = () => {
			if (slideIndex.value < elements.value.length - 1) {
				slideIndex.value++;
				currentSlide.value = elements.value[slideIndex.value];
				playSE('slide');
			} else {
				router.push('/demo-draw');
			}
		};
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') nextSlide();
		};
		onMounted(() => window.addEventListener('keydown', handleKey));
		onUnmounted(() => window.removeEventListener('keydown', handleKey));

		const isHtml = (s: any) => {
			if (!s || typeof s !== 'string') return false;
			return /<[^>]+>/.test(s);
		};

		return { screenConfig, currentSlide, slideIndex, elements, isHtml };
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

.slide-container {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	max-width: 1200px;
	padding: 2rem;
}

.slide-content {
	width: 100%;
	text-align: center;
}

.slide-text {
	font-size: 2.5rem;
	font-weight: 300;
	color: #ffffff;
	text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
	line-height: 1.4;
	margin-bottom: 2rem;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.slide-html {
	font-size: 1.8rem;
	color: #e0e0e0;
	line-height: 1.6;
	margin-bottom: 2rem;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.slide-html h1,
.slide-html h2,
.slide-html h3 {
	color: #ffffff;
	margin-bottom: 1rem;
}

.slide-html p {
	margin-bottom: 1rem;
}

.slide-image {
	max-width: 80%;
	max-height: 60vh;
	border-radius: 12px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.slide-modal {
	background: rgba(255, 255, 255, 0.1);
	backdrop-filter: blur(10px);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 16px;
	padding: 2rem;
	max-width: 600px;
	margin: 0 auto;
	color: #ffffff;
	font-size: 1.5rem;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.navigation-hint {
	position: absolute;
	bottom: 2rem;
	left: 50%;
	transform: translateX(-50%);
	text-align: center;
}

.hint-text {
	color: #b0b0b0;
	font-size: 1.2rem;
	font-weight: 300;
	margin-bottom: 1rem;
	display: block;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.progress-dots {
	display: flex;
	justify-content: center;
	gap: 0.5rem;
}

.dot {
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.3);
	transition: all 0.3s ease;
}

.dot.active {
	background: #ffffff;
	box-shadow: 0 0 12px rgba(255, 255, 255, 0.8);
	transform: scale(1.2);
}

.slide-transition-enter-active,
.slide-transition-leave-active {
	transition: all 0.5s ease;
}

.slide-transition-enter-from {
	opacity: 0;
	transform: translateY(30px);
}

.slide-transition-leave-to {
	opacity: 0;
	transform: translateY(-30px);
}
</style>
