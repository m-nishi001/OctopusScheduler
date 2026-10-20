<template>
	<MainLayout>
		<div class="description-screen">

			<transition name="initial-to-slide" mode="out-in">
				<div v-if="slideIndex === -1" class="description-content">
					<h2 class="description-title">説明画面</h2>
					<p class="description-text">ここにゲームの説明を記載します。</p>
					<p class="description-text">Enterキーを押して次へ進んでください。</p>
				</div>

				<div v-else class="content-frame">
					<div class="inner-border">
						<div class="inner-frame">
							<div class="slide-container">
								<transition name="slide-transition" mode="out-in">
									<div v-if="currentSlide" :key="currentSlide && (currentSlide.id || slideIndex)"
										class="slide-content">
										<template v-if="currentSlide.type === 'text'">
											<div v-if="isHtml(getContent(currentSlide))" class="slide-html"
												v-html="getContent(currentSlide)">
											</div>
											<div v-else class="slide-text">{{ getContent(currentSlide) }}</div>
										</template>
										<template v-if="currentSlide.type === 'image'">
											<img :src="currentSlide.assetUrl" class="slide-image" />
										</template>
										<template v-if="currentSlide.type === 'modal'">
											<div class="slide-modal">{{ currentSlide.content }}</div>
										</template>
										<template v-if="currentSlide.type === 'html'">
											<div class="slide-html" v-html="getContent(currentSlide)"></div>
										</template>
									</div>
								</transition>
							</div>
						</div>
					</div>
				</div>
			</transition>

			<div v-if="slideIndex !== -1">
				<div class="navigation-hint">
					<div class="progress-dots">
						<span v-for="(element, index) in elements" :key="element.id" class="dot"
							:class="{ active: index === slideIndex }"></span>
					</div>
				</div>
			</div>

		</div>
	</MainLayout>
</template>
<script lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useScreenAssetUrls, useScreenBgm } from '../../composables/use-screen-media';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import { useJackpotSession } from '../../composables/use-jackpot-session';
import { useJackpotHost } from '../../composables/use-jackpot-host';
import { buildJackpotDescriptionState } from '@model/jackpot-host-state';
import type { ScreenElement } from '@model/screen-config/description-screen-setting';
import { DescriptionScreenSetting } from '@model/screen-config/description-screen-setting';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { container } from 'tsyringe';
export default {
	name: 'Description',
	components: { MainLayout },
	setup() {
		const router = useRouter();
		const session = useJackpotSession();

		const screenConfig = ref<DescriptionScreenSetting | null>(null);
		const screenSettingsService = container.resolve(ScreenSettingsService);

		const slideIndex = ref(-1);
		const currentSlide = ref<ScreenElement | null>(null);

		const elements = ref<ScreenElement[]>([]);



		// 画像のURLとBGMの読み込みと後始末（画面を離れたら止めて、URLを破棄する）
		const assetUrls = useScreenAssetUrls();
		const bgm = useScreenBgm();
		const ready = ref(false);

		onMounted(async () => {

			const cfg = await screenSettingsService.fetchScreenSetting('description', 'description-screen-settings');


			if (cfg) {

				const bgmId = (cfg as any).descriptionBgm || (cfg as any).bgmAssetId || '';
				const elems = (cfg as any).screenElements || (cfg as any).contents || [];
				screenConfig.value = new DescriptionScreenSetting(bgmId, elems as ScreenElement[]);
			} else {
				screenConfig.value = null;
			}

			elements.value = screenConfig.value?.screenElements || [];
			// スライドの枚数が決まってから管理端末へ公開する(読み込み中に「枚数0」を見せない)
			ready.value = true;


			await assetUrls.attach(elements.value);
			await bgm.load(screenConfig.value?.descriptionBgm);
			bgm.play();
		});

		const nextSlide = () => {
			if (slideIndex.value < elements.value.length - 1) {
				slideIndex.value++;

				if (slideIndex.value >= 0 && slideIndex.value < elements.value.length) {
					currentSlide.value = elements.value[slideIndex.value];
				} else {
					currentSlide.value = null;
				}
			} else {

				bgm.bgm.value?.pause();
				router.push(session.to('/jackpot-draw'));
			}
		};
		const prevSlide = () => {
			// 導入画面(-1)より前には戻らない
			if (slideIndex.value < 0) return;
			slideIndex.value--;
			currentSlide.value = slideIndex.value >= 0 ? elements.value[slideIndex.value] : null;
		};

		// 管理端末(コントロール画面)の「次へ/前へ」を、この画面のEnterキーと同じ進行にする。現在位置を公開する。
		// setup() の同期実行中に呼ぶ(コンポーネントの破棄時に後片付けを登録するため)。
		const host = useJackpotHost({ advance: nextSlide, back: prevSlide, stopRoulette: () => undefined });
		watch(
			[ready, slideIndex, elements],
			() => {
				if (ready.value) host.publish(buildJackpotDescriptionState(slideIndex.value, elements.value.length));
			},
			{ immediate: true }
		);
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') nextSlide();
		};
		onMounted(() => window.addEventListener('keydown', handleKey));
		onUnmounted(() => {
			try { window.removeEventListener('keydown', handleKey); } catch { }
		});

		const isHtml = (s: any) => {
			if (!s || typeof s !== 'string') return false;
			return /<[^>]+>/.test(s);
		};

		const getContent = (el: any) => {
			if (!el) return '';
			if (el.content && typeof el.content === 'string') return el.content;

			return (el.text && typeof el.text === 'string') ? el.text : '';
		};

		return { screenConfig, currentSlide, slideIndex, elements, isHtml, getContent, nextSlide, prevSlide };
	},
};
</script>

<style scoped>
.description-screen {
	width: 100vw;
	height: 100vh;
	background: linear-gradient(135deg, #2b1438 0%, #5a2b6f 50%, #2a1632 100%);
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
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	color: #ffffff;
	text-align: center;
	z-index: 1;
}

.description-title {
	font-size: 3.2rem;
	font-weight: 300;
	color: #ffffff;
	text-shadow: 0 0 20px rgba(255, 255, 255, 0.25);
	margin-bottom: 1.6rem;
}

.description-text {
	font-size: 1.25rem;
	color: rgba(255, 255, 255, 0.85);
	line-height: 1.6;
	margin-bottom: 0.8rem;
}

.content-frame {
	width: 86%;
	height: 72%;
	background: #0b0b0b;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 2.4rem;
	position: relative;
	overflow: hidden;
}

.inner-border {
	width: 100%;
	height: 100%;
	padding: 1.2rem;
	box-sizing: border-box;
	border: none;
	display: flex;
	justify-content: center;
	align-items: center;
}

.inner-frame {
	width: 100%;
	height: 100%;
	background: #0b0b0b;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 1.6rem;
	min-height: 56vh;
}

.slide-container {
	flex: 1 1 auto;
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	max-width: 100%;
	padding: 1rem 0;
	overflow: hidden;
}

.slide-content {
	width: 100%;
	max-width: 80%;
	text-align: left;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: flex-start;
}

.slide-text {
	/* smaller, centered simple text similar to attachment 1 */
	font-size: 1rem;
	font-weight: 300;
	color: #dcdcdc;
	line-height: 1.4;
	margin: 0;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.slide-html {
	font-size: 1.8rem;
	color: #e0e0e0;
	line-height: 1.6;
	margin-bottom: 2rem;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	max-width: 100%;
	max-height: 100%;
	width: 100%;
	height: 100%;
	margin: 0;
	padding: 0;
	box-sizing: border-box;
	overflow: hidden;
}

/* Force embedded HTML to respect container bounds */
.slide-html,
.slide-html * {
	max-width: 100% !important;
	box-sizing: border-box !important;
}

/* Make media scale down to fit the container */
.slide-html img,
.slide-html video,
.slide-html iframe {
	max-width: 100% !important;
	height: auto !important;
	display: block;
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
	position: relative;
	margin: 12px auto 4px auto;
	left: 0;
	transform: none;
	text-align: center;
	pointer-events: none;
	/* make dots non-interactive */
	width: 100%;
	display: flex;
	justify-content: center;
}

.progress-dots {
	display: flex;
	justify-content: center;
	gap: 0.75rem;
	margin-bottom: 0.8rem;
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

.initial-to-slide-enter-active,
.initial-to-slide-leave-active {
	transition: opacity 0.5s ease, transform 0.5s ease;
}

.initial-to-slide-enter-from {
	opacity: 0;
	transform: translateY(24px) scale(0.995);
}

.initial-to-slide-leave-to {
	opacity: 0;
	transform: translateY(-18px) scale(0.995);
}
</style>
