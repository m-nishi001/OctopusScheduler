<template>
	<MainLayout :fullScreen="true">
		<div class="description-screen" data-testid="description-screen">
			<Loader v-if="!ready" label="読み込み中..." />
			<template v-else>
				<!-- 1ページずつ。画像は画面いっぱいに比率を保って、テキストは中央に大きく出す -->
				<transition name="page" mode="out-in">
					<div v-if="page" :key="index" class="page" data-testid="description-page" :data-index="index">
						<img v-if="page.kind === '画像' && page.imageUrl" :src="page.imageUrl" class="page-image" data-testid="description-image" alt="" />
						<div v-else-if="page.kind === 'テキスト'" class="page-text" data-testid="description-text">{{ page.text }}</div>
					</div>
					<div v-else class="page-empty" data-testid="description-empty">説明のページがありません(Enterで次へ)</div>
				</transition>
				<div v-if="total > 1" class="progress-dots">
					<span v-for="(_, i) in pages" :key="i" class="dot" :class="{ active: i === index }"></span>
				</div>
			</template>
		</div>
	</MainLayout>
</template>
<script lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { container } from 'tsyringe';
import { useRouter } from 'vue-router';
import MainLayout from '../common/main-layout.vue';
import Loader from '../common/loader.vue';
import { useScreenMedia } from '../../composables/use-screen-media';
import { useJackpotSession } from '../../composables/use-jackpot-session';
import { useJackpotHost } from '../../composables/use-jackpot-host';
import { buildJackpotDescriptionState } from '@model/jackpot-host-state';
import { parseDescriptionSettings, stepPage } from '@model/screen-config/description-setting';
import { parseDemoDrawSettings } from '@model/screen-config/demo-draw-setting';
import { nextScreen, SCREEN_PATH } from '@model/screen-flow';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';

export default {
	name: 'Description',
	components: { MainLayout, Loader },
	setup() {
		const router = useRouter();
		const session = useJackpotSession();

		// 設定・BGM・画像の準備ができてから画面を出し、BGM を鳴らす。画面を離れたら止めて、後始末する。
		const { config } = useScreenMedia({
			screenName: 'description',
			settingName: 'description-screen-settings',
			parse: parseDescriptionSettings,
			items: (c) => c.pages,
		});
		/** デモ抽選を挟むか(説明のあとの行き先を決める)。 */
		const demoDraw = ref<boolean | null>(null);
		onMounted(async () => {
			try {
				demoDraw.value = parseDemoDrawSettings(await container.resolve(ScreenSettingsService).fetchScreenSetting('demo', 'demo-screen-settings')).enabled;
			} catch (e) {
				console.error('[Description] failed to load demo draw settings', e);
				demoDraw.value = true;
			}
		});

		const ready = computed(() => config.value !== null && demoDraw.value !== null);
		const pages = computed(() => config.value?.pages ?? []);
		const total = computed(() => pages.value.length);
		const index = ref(0);
		const page = computed(() => pages.value[index.value] ?? null);

		const leave = () => {
			const next = nextScreen('description', { demoDraw: demoDraw.value ?? true, entry: false });
			if (next) void router.push(session.to(SCREEN_PATH[next]));
		};
		const move = (delta: 1 | -1) => {
			if (!ready.value) return;
			const step = stepPage(index.value, total.value, delta);
			if (step.kind === 'leave') leave();
			else index.value = step.index;
		};
		const next = () => move(1);
		const prev = () => move(-1);

		// 管理端末(コントロール画面)の「次へ/前へ」を、この画面のEnterキーと同じ進行にする。現在位置を公開する。
		// setup() の同期実行中に呼ぶ(コンポーネントの破棄時に後片付けを登録するため)。
		const host = useJackpotHost({ advance: next, back: prev, stopRoulette: () => undefined });
		// ページ数が決まってから管理端末へ公開する(読み込み中に「0ページ」を見せない)
		watch([ready, index, total], () => {
			if (ready.value) host.publish(buildJackpotDescriptionState(index.value, total.value));
		}, { immediate: true });

		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter') next();
		};
		onMounted(() => window.addEventListener('keydown', handleKey));
		onUnmounted(() => window.removeEventListener('keydown', handleKey));

		return { ready, pages, total, index, page };
	},
};
</script>

<style scoped>
.description-screen {
	width: 100vw;
	height: 100vh;
	background: #0b0b0b;
	color: #fff;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	position: relative;
	overflow: hidden;
}

.page {
	position: absolute;
	inset: 0;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 4vh 6vw;
	box-sizing: border-box;
}

.page-image {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
}

.page-text {
	max-width: 90%;
	font-size: clamp(2rem, 5vw, 4.5rem);
	line-height: 1.5;
	text-align: center;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.page-empty {
	color: rgba(255, 255, 255, 0.6);
	font-size: 1.25rem;
}

.progress-dots {
	position: absolute;
	bottom: 2.5vh;
	display: flex;
	gap: 0.6rem;
	pointer-events: none;
}

.dot {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.3);
	transition: all 0.3s ease;
}

.dot.active {
	background: #fff;
	box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
	transform: scale(1.2);
}

.page-enter-active,
.page-leave-active {
	transition: opacity 0.35s ease;
}

.page-enter-from,
.page-leave-to {
	opacity: 0;
}
</style>
