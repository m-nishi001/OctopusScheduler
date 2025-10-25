<template>
	<MainLayout>
		<div class="description-screen">
			<!-- show initial full-screen description hint when slideIndex is -1 -->
			<transition name="initial-to-slide" mode="out-in">
				<div v-if="slideIndex === -1" class="description-content">
					<h2 class="description-title">説明画面</h2>
					<p class="description-text">ここにゲームの説明を記載します。</p>
					<p class="description-text">Enterキーを押して次へ進んでください。</p>
				</div>
				<!-- otherwise show framed slide area -->
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
			<!-- only show navigation controls (dots) when slides are active -->
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
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import type { ScreenElement } from '../../../model/domains/screen-config/description-screen-setting';
import { DescriptionScreenSetting } from '../../../model/domains/screen-config/description-screen-setting';
import { ScreenSettingsService } from '../../../model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';
import { container } from 'tsyringe';
export default {
	name: 'Description',
	components: { MainLayout },
	setup() {
		const router = useRouter();

		const screenConfig = ref<DescriptionScreenSetting | null>(null);
		const screenSettingsService = container.resolve(ScreenSettingsService);
		// start at -1 so initial screen shows hint; first Enter will advance to index 0
		const slideIndex = ref(-1);
		const currentSlide = ref<ScreenElement | null>(null);

		const elements = ref<ScreenElement[]>([]);

		const assetService = container.resolve(AssetDataService);

		// track created object URLs so they can be revoked on unmount
		const createdUrls: string[] = [];

		onMounted(async () => {
			// fetch raw config (may use differing key names depending on admin UI)
			const cfg = await screenSettingsService.fetchScreenSetting('description', 'description-screen-settings');

			// normalize to DescriptionScreenSetting shape so component can work with both legacy and current payloads
			if (cfg) {
				// cfg may use descriptionBgm / screenElements OR bgmAssetId / contents
				const bgmId = (cfg as any).descriptionBgm || (cfg as any).bgmAssetId || '';
				const elems = (cfg as any).screenElements || (cfg as any).contents || [];
				screenConfig.value = new DescriptionScreenSetting(bgmId, elems as ScreenElement[]);
			} else {
				screenConfig.value = null;
			}

			elements.value = screenConfig.value?.screenElements || [];

			// create object URLs for element assets (images etc.)
			for (const element of elements.value) {
				if (element.assetId) {
					const asset = await assetService.getAssetDataById(element.assetId);
					if (asset && asset.blob) {
						try {
							const url = URL.createObjectURL(asset.blob);
							element.assetUrl = url;
							createdUrls.push(url);
						} catch (e) {
							element.assetUrl = '';
						}
					} else {
						element.assetUrl = '';
					}
				}
			}

			// do not show slides immediately; wait for user to press Enter
			// currentSlide will be set when slideIndex changes via nextSlide()

			// load and play BGM if configured (BGM stored as an asset id)
			try {
				const bgmId = screenConfig.value?.descriptionBgm || '';
				if (bgmId) {
					const bgmAsset = await assetService.getAssetDataById(bgmId);
					if (bgmAsset && bgmAsset.blob) {
						try {
							const bgmUrl = URL.createObjectURL(bgmAsset.blob);
							createdUrls.push(bgmUrl);
							const audio = new Audio(bgmUrl);
							audio.loop = true;
							// best-effort play (may be blocked by browser autoplay policies)
							void audio.play().catch(() => { });
						} catch (e) {
							// ignore bgm errors
						}
					}
				}
			} catch (e) {
				// ignore
			}
		});

		const nextSlide = () => {
			if (slideIndex.value < elements.value.length - 1) {
				slideIndex.value++;
				// only update currentSlide when slideIndex is within range
				if (slideIndex.value >= 0 && slideIndex.value < elements.value.length) {
					currentSlide.value = elements.value[slideIndex.value];
				} else {
					currentSlide.value = null;
				}
			} else {
				router.push('/jackpot-demo');
			}
		};
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') nextSlide();
		};
		onMounted(() => window.addEventListener('keydown', handleKey));
		onUnmounted(() => {
			try { window.removeEventListener('keydown', handleKey); } catch { }

			try {
				for (const el of elements.value) {
					if (el.assetUrl) {
						try { URL.revokeObjectURL(el.assetUrl); } catch { }
					}
				}
				for (const u of createdUrls) {
					try { URL.revokeObjectURL(u); } catch { }
				}
			} catch { }
		});

		const isHtml = (s: any) => {
			if (!s || typeof s !== 'string') return false;
			return /<[^>]+>/.test(s);
		};

		const getContent = (el: any) => {
			if (!el) return '';
			if (el.content && typeof el.content === 'string') return el.content;
			// legacy admin UI used `text` property for plain text entries
			return (el.text && typeof el.text === 'string') ? el.text : '';
		};

		return { screenConfig, currentSlide, slideIndex, elements, isHtml, getContent, nextSlide };
	},
};
</script>

<style scoped>
.description-screen {
	width: 100vw;
	height: 100vh;
	/* purple-ish gradient like attachment 2 */
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
	/* ensure white text */
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
	/* deep black content area */
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 2.4rem;
	position: relative;
	overflow: visible;
}

.inner-border {
	width: 100%;
	height: 100%;
	padding: 1.2rem;
	box-sizing: border-box;
	/* remove the inner white border (unwanted decorative brackets) */
	border: none;
	/* outer thin white border */
	display: flex;
	justify-content: center;
	align-items: center;
}

.inner-frame {
	width: 100%;
	height: 100%;
	background: #0b0b0b;
	/* same black, acts like inner canvas */
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
	text-align: center;
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

/* navigation hint sits near the very bottom of the screen when slides are active
	   we will not show the small 'Press ENTER' hint inside the framed area, so keep
	   this container for dots only */
.navigation-hint {
	/* place dots in normal flow below the frame so they are never clipped on small screens */
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

/* transition between the initial full-screen hint and the framed slide area */
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
