<template>
	<MainLayout>
		<div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
			<transition-group name="slide-in" tag="div">
				<div v-if="currentSlide" :key="currentSlide.id" class="slide-item">
					<template v-if="currentSlide.type === 'text'">
						<div v-if="isHtml(currentSlide.content)" class="mb-6" v-html="currentSlide.content"></div>
						<h2 v-else class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">{{ currentSlide.content
							}}</h2>
					</template>
					<template v-if="currentSlide.type === 'image'">
						<img :src="currentSlide.assetUrl" class="mx-auto mb-4" />
					</template>
					<template v-if="currentSlide.type === 'modal'">
						<div class="modal-content">{{ currentSlide.content }}</div>
					</template>
				</div>
			</transition-group>
			<p class="text-lg text-gray-700 mb-4">Enterキーで次のスライド</p>
		</div>
	</MainLayout>
</template>
<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import type { ScreenElementDto } from '../../../model/applications/dto/screen-config-dto';
import type { ScreenConfigDto } from '../../../model/applications/dto/screen-config-dto';
import { ScreenConfigService } from '../../../model/applications/screen-config-service';
import { container } from 'tsyringe';
export default {
	name: 'Description',
	components: { MainLayout },
	setup() {
		const router = useRouter();
		// ScreenConfigServiceから取得
		const screenConfig = ref<ScreenConfigDto | null>(null);
		const screenConfigService = container.resolve(ScreenConfigService);
		const slideIndex = ref(0);
		const currentSlide = ref<ScreenElementDto | null>(null);
		onMounted(async () => {
			screenConfig.value = await screenConfigService.fetchScreenConfig('description');
			currentSlide.value = screenConfig.value?.elements[0] ?? null;
			setTimeout(playBGM, 1200);
		});

		// BGM/SE制御
		const bgmAudio = ref<HTMLAudioElement | null>(null);
		const playBGM = () => {
			if (!screenConfig.value?.bgmAssetUrl) return;
			if (!bgmAudio.value) {
				bgmAudio.value = new Audio(screenConfig.value.bgmAssetUrl);
				bgmAudio.value.loop = true;
			}
			bgmAudio.value.play();
		};

		const playSE = (seType: string) => {
			if (!screenConfig.value?.seAssetUrls) return;
			const assetUrl = screenConfig.value.seAssetUrls.find(url => url.includes(seType));
			if (!assetUrl) return;
			const seAudio = new Audio(assetUrl);
			seAudio.play();
		};

		// スライド管理
		const nextSlide = () => {
			if (!screenConfig.value) return;
			if (slideIndex.value < screenConfig.value.elements.length - 1) {
				slideIndex.value++;
				currentSlide.value = screenConfig.value.elements[slideIndex.value];
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

		return { screenConfig, currentSlide, isHtml };
	},
};
</script>
