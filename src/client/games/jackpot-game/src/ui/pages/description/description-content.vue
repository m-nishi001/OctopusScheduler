<template>
	<MainLayout>
		<div class="description-screen">
			<div class="content-frame">
				<div class="slide-container">
					<transition-group name="slide-transition" tag="div">
						<div v-if="currentSlide" :key="currentSlide.id" class="slide-content">
							<template v-if="currentSlide.type === 'text'">
								<div v-if="isHtml(currentSlide.content)" class="slide-html"
									v-html="currentSlide.content">
								</div>
								<div v-else class="slide-text">{{ currentSlide.content }}</div>
							</template>
							<template v-if="currentSlide.type === 'image'">
								<img :src="currentSlide.assetUrl" class="slide-image" />
							</template>
							<template v-if="currentSlide.type === 'modal'">
								<div class="slide-modal">{{ currentSlide.content }}</div>
							</template>
							<template v-if="currentSlide.type === 'html'">
								<div class="slide-html" v-html="currentSlide.content"></div>
							</template>
						</div>
					</transition-group>
				</div>
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
import type { ScreenElement } from '../../../model/domains/screen-config/description-screen-setting';
import { DescriptionScreenSetting } from '../../../model/domains/screen-config/description-screen-setting';
import { ScreenConfigService } from '../../../model/applications/screen-config/screen-config-service';
import { AssetService } from '../../../model/applications/asset/asset-service';
import { container } from 'tsyringe';
export default {
	name: 'Description',
	components: { MainLayout },
	setup() {
		const router = useRouter();
		// ScreenConfigRepositoryから取得
		const screenConfig = ref<DescriptionScreenSetting | null>(null);
		const screenConfigService = container.resolve(ScreenConfigService);
		const slideIndex = ref(0);
		const currentSlide = ref<ScreenElement | null>(null);

		const elements = ref<ScreenElement[]>([]);

		const bgmAssetUrl = computed(() => (screenConfig.value as DescriptionScreenSetting)?.descriptionBgm);

		const assetService = container.resolve(AssetService);

		onMounted(async () => {
			screenConfig.value = await screenConfigService.fetchScreenConfig('description') as DescriptionScreenSetting;
			elements.value = screenConfig.value?.screenElements || [];
			for (const element of elements.value) {
				if (element.assetId) {
					const asset = await assetService.getAssetById(element.assetId);
					element.assetUrl = asset?.dataUrl || '';
				}
			}
			if (elements.value.length > 0) {
				currentSlide.value = elements.value[0];
			}
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

		// スライド管理
		const nextSlide = () => {
			if (slideIndex.value < elements.value.length - 1) {
				slideIndex.value++;
				currentSlide.value = elements.value[slideIndex.value];
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

.content-frame {
	width: 80%;
	height: 70%;
	border: 2px solid rgba(255, 255, 255, 0.5);
	border-radius: 16px;
	background: rgba(255, 255, 255, 0.1);
	backdrop-filter: blur(10px);
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 2rem;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.slide-container {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	max-width: 100%;
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
