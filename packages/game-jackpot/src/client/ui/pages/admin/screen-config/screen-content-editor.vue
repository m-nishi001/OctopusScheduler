<template>
	<div class="screen-config">
		<h3>{{ title }}</h3>
		<p class="section-hint" data-testid="editor-hint">{{ hint }}</p>
		<div class="config-item">
			<MediaPicker label="BGM" kind="audio"   :model-value="localConfig.bgm" @update:model-value="form.set('bgm', $event)" :options="draft.optionsOf('audio')"
				:preview-url="draft.urlOf(localConfig.bgm)" @pick="draft.pick" />
		</div>

		<div class="config-item">
			<label>{{ isDescription ? 'ページ' : '項目' }}:</label>
			<UiToolbar>
				<UiButton variant="primary" icon="add" @click="showAddDialog">追加</UiButton>
				<UiButton variant="danger" icon="delete" :disabled="!selectedIndices.length"
					@click="deleteSelected">選択削除</UiButton>
			</UiToolbar>

			<div class="select-all-row">
				<input type="checkbox" class="select-checkbox" v-model="isAllSelected" />
			</div>

			<div v-if="localConfig.entries.length === 0" class="empty-note">{{ isDescription ? 'ページがありません。追加してください。' : '項目がありません。追加してください。' }}</div>

			<ul class="content-list" data-testid="entry-list">
				<li v-for="(entry, idx) in localConfig.entries" :key="idx" class="content-list-item" data-testid="entry-row">
					<div class="select-col">
						<input type="checkbox" class="row-checkbox" :value="idx" v-model="selectedIndices" />
					</div>
					<div class="content-summary">
						<span class="content-index">{{ idx + 1 }}.</span>
						<span class="content-title">{{ titleOf(entry) }}</span>
					</div>
					<div class="content-list-actions">
						<UiButton @click="showEditDialog(idx)">詳細</UiButton>
						<UiButton variant="danger" @click="removeEntry(idx)">削除</UiButton>
						<UiButton @click="moveUp(idx)" :disabled="idx === 0">↑</UiButton>
						<UiButton @click="moveDown(idx)" :disabled="idx === localConfig.entries.length - 1">↓</UiButton>
					</div>
				</li>
			</ul>
		</div>

		<UiBusyOverlay :visible="saving" title="保存中..." :message="saveStatus" />

		<UiDialog :model-value="dialogVisible" :title="editingIndex === -1 ? (isDescription ? 'ページを追加' : '項目を追加') : (isDescription ? 'ページを編集' : '項目を編集')" size="md"
			nested :close-on-overlay="false" confirm-label="保存" @confirm="saveDialog" @close="closeDialog">
				<div class="content-controls form-group">
					<template v-if="!isDescription">
						<label>名前(一覧に出す名前)</label>
						<input v-model="dialogEntry.name" placeholder="名前" data-testid="entry-name" />
					</template>

					<label>種類</label>
					<select v-model="dialogEntry.kind" data-testid="entry-kind" @change="onKindChange">
						<option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
					</select>

					<template v-if="dialogEntry.kind === 'テキスト'">
						<label>文字(改行はそのまま表示されます)</label>
						<textarea v-model="dialogEntry.text" placeholder="表示する文字" rows="5" data-testid="entry-text"></textarea>
					</template>

					<MediaPicker v-if="dialogEntry.kind === '画像'" label="画像" kind="image" v-model="dialogImage"
						:options="draft.optionsOf('image')" :preview-url="draft.urlOf(dialogImage)" @pick="draft.pick" />

					<template v-if="!isDescription">
						<label>効果</label>
						<select v-model="dialogEntry.effect" data-testid="entry-effect">
							<option v-for="e in effectsFor(dialogEntry.kind)" :key="e" :value="e">{{ e }}</option>
						</select>
						<p class="field-hint" data-testid="effect-hint">{{ EFFECT_HINT[dialogEntry.effect] }}</p>

						<div class="content-row">
							<div class="field-col">
								<label>秒数(秒)</label>
								<input v-model.number="dialogEntry.seconds" type="number" min="0.1" step="0.1" placeholder="秒" data-testid="entry-seconds" />
							</div>
							<div v-if="dialogEntry.effect === '行送り'" class="field-col">
								<label>行数(1回に送る行)</label>
								<input v-model.number="dialogEntry.lines" type="number" min="1" max="20" step="1" placeholder="行" data-testid="entry-lines" />
							</div>
						</div>

						<MediaPicker label="効果音(項目の始めに鳴らす)" kind="audio" v-model="dialogSe" :options="draft.optionsOf('audio')"
							:preview-url="draft.urlOf(dialogSe)" @pick="draft.pick" />
					</template>
				</div>

		</UiDialog>

		<div style="display:flex;align-items:center;gap:12px;margin-top:24px;">
			<UiButton @click="handleSaveClick" :disabled="saving">保存</UiButton>
			<div class="status-text">{{ saveStatus }}</div>
		</div>

		<UnsavedChangesDialog :visible="showUnsavedDialog" @discard="discardChanges" @cancel="cancelNavigation" />
	</div>
</template>

<script setup lang="ts">
import { UiBusyOverlay, UiButton, UiDialog, UiToolbar } from '@octopus/ui-kit';
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { eventBus } from '@octopus/client-common/events/event-bus';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { useMediaDraft } from '@ui/composables/use-media-draft';
import { useFormDraft } from '@ui/composables/use-form-draft';
import MediaPicker from '@ui/components/media-picker.vue';
import {
	clampLines,
	clampSeconds,
	newSequenceItem,
	parseSequenceSettings,
	toStoredSequence,
	SEQUENCE_EFFECTS,
	SEQUENCE_KINDS,
	DEFAULT_SEQUENCE_LINES,
	type SequenceEffect,
	type SequenceItem,
	type SequenceKind,
} from '@model/screen-config/sequence-setting';
import {
	DESCRIPTION_KINDS,
	newDescriptionPage,
	parseDescriptionSettings,
	toStoredDescription,
	type DescriptionPage,
} from '@model/screen-config/description-setting';
import UnsavedChangesDialog from './unsaved-changes-dialog.vue';
import { onBeforeRouteLeave } from 'vue-router';

/**
 * 説明(1ページずつ手で送る)と、オープニング・エンディング(自動で流れる)の画面設定フォーム。
 * どちらも「BGM + 並んだエントリー(ページ / 項目)」の編集で、エントリーの形だけが違う。
 *  - mode "description": ページ = 種類(画像 / テキスト)と、画像かテキスト。効果・秒数・効果音は持たない。
 *  - mode "sequence": 項目 = 種類(テキスト / 画像)・効果(流れる / 行送り / フェード / 静止)・秒数(秒)・行数・効果音。
 * autoSaveOnDeleteは、ending画面のみ既存挙動として「削除操作で即保存する」動きだったため、その差異をそのまま維持するためのフラグ。
 */
const props = withDefaults(
	defineProps<{
		screenName: string;
		settingName: string;
		title: string;
		mode?: 'sequence' | 'description';
		autoSaveOnDelete?: boolean;
	}>(),
	{ mode: 'sequence', autoSaveOnDelete: false }
);

const isDescription = computed(() => props.mode === 'description');
const hint = computed(() =>
	isDescription.value
		? '説明は1ページずつ表示します。Enter(または管理端末の「次へ」)で次のページへ、最後のページの次でデモ抽選(OFF なら本抽選)へ進みます。画像かテキストのページを並べてください。'
		: '項目を上から順に自動で流します。項目ごとに効果と秒数を決められ、項目の始めに効果音を鳴らせます。「3行ずつ上へ送る文章 → 画像(フェード) → 続きの文章」は、項目を3つ並べて作ります。'
);

const EFFECT_HINT: Record<SequenceEffect, string> = {
	流れる: 'エンドロールのように、文章や画像の全体を下から上へ流します。秒数は、流れ切るまでの長さです。',
	行送り: '行数ぶんの行を出し、秒数おきに上へ送ります。テキストだけで使えます(長い文章を少しずつ見せたいとき)。',
	フェード: 'ふわっと現れて、消えます。秒数は、現れてから消えるまでの長さです。',
	静止: 'そのまま動かさずに出します。秒数は、出している長さです。',
};

const kinds = computed<readonly string[]>(() => (isDescription.value ? DESCRIPTION_KINDS : SEQUENCE_KINDS));
/** 行送りは、テキストでだけ選べる。 */
const effectsFor = (kind: string): readonly SequenceEffect[] => (kind === 'テキスト' ? SEQUENCE_EFFECTS : SEQUENCE_EFFECTS.filter((e) => e !== '行送り'));

type Entry = SequenceItem | DescriptionPage;

const screenSettingsService = container.resolve(ScreenSettingsService);
const draft = useMediaDraft();

const saving = ref(false);
const saveStatus = ref('');

const showUnsavedDialog = ref(false);
const pendingRoute = ref<(() => void) | null>(null);

/** サーバーの値(読み込み・同期で更新)に、利用者が触った項目だけを重ねて持つ。入力は読み込み前から操作できる。 */
interface ContentForm {
	bgm: string;
	entries: Entry[];
}

const fetchConfig = async (): Promise<ContentForm> => {
	const raw = await screenSettingsService.fetchScreenSetting(props.screenName, props.settingName);
	if (isDescription.value) {
		const s = parseDescriptionSettings(raw);
		return { bgm: s.bgm, entries: s.pages };
	}
	const s = parseSequenceSettings(raw);
	return { bgm: s.bgm, entries: s.items };
};
const form = useFormDraft<ContentForm>({ bgm: '', entries: [] }, fetchConfig);
const localConfig = form.view;
const hasUnsavedChanges = form.dirty;

/** エントリーが参照している素材の名前(画像・効果音)。 */
const mediaNamesOf = (entries: readonly Entry[]) => entries.flatMap((e) => [e.image, (e as SequenceItem).se]);

// 参照している素材(BGM・画像と効果音)のプレビューを用意する
draft.track(() => [localConfig.value.bgm, ...mediaNamesOf(localConfig.value.entries)]);

// 他の端末の変更が取り込まれたら読み直す(古い値のフォームを、そのまま保存して上書きしないため)。
// 読み込みは「サーバーの値」だけを更新し、入力の途中の項目には触れない
const reloadAfterSync = () => form.load();

onMounted(async () => {
	eventBus.on('syncPulled', reloadAfterSync);
	await Promise.all([form.load(), draft.reload()]);
});

onBeforeRouteLeave((_to, _from, next) => {
	if (hasUnsavedChanges.value) {
		showUnsavedDialog.value = true;
		pendingRoute.value = next;
	} else {
		next();
	}
});

const discardChanges = () => {
	showUnsavedDialog.value = false;
	form.discard();
	if (pendingRoute.value) {
		pendingRoute.value();
	}
};

const cancelNavigation = () => {
	showUnsavedDialog.value = false;
	pendingRoute.value = null;
};

const dialogVisible = ref(false);
const editingIndex = ref<number>(-1);

/** ダイアログで編集中のエントリー(両方の形のフィールドを持つ作業用の形。保存のときに、モードに合うものだけを取り出す)。 */
interface DialogEntry {
	kind: SequenceKind | DescriptionPage['kind'];
	name: string;
	text: string;
	image: string;
	effect: SequenceEffect;
	seconds: number;
	lines: number;
	se: string;
}

const createEmptyEntry = (): DialogEntry => {
	const base = isDescription.value ? newDescriptionPage() : newSequenceItem();
	return toDialog(base);
};

const toDialog = (e: Entry): DialogEntry => {
	const item = e as SequenceItem;
	return {
		kind: e.kind,
		name: item.name ?? '',
		text: e.text ?? '',
		image: e.image ?? '',
		effect: item.effect ?? 'フェード',
		seconds: item.seconds ?? 3,
		lines: item.lines ?? DEFAULT_SEQUENCE_LINES,
		se: item.se ?? '',
	};
};

/** ダイアログの入力を、保存する形にそろえる(種類に合わない素材・文字は持たない)。 */
const fromDialog = (d: DialogEntry): Entry => {
	if (isDescription.value) {
		return d.kind === '画像' ? { kind: '画像', image: d.image } : { kind: 'テキスト', text: d.text };
	}
	const item: SequenceItem = { kind: d.kind as SequenceKind, effect: d.effect, seconds: clampSeconds(d.seconds) };
	if (d.kind === 'テキスト') item.text = d.text;
	else item.image = d.image;
	if (d.effect === '行送り') item.lines = clampLines(d.lines);
	if (d.se) item.se = d.se;
	if (d.name) item.name = d.name;
	return item;
};

const dialogEntry = ref<DialogEntry>(createEmptyEntry());
// 画像・効果音の素材の名前(未設定は空)。ダイアログの入力欄に結ぶ
const dialogImage = computed({ get: () => dialogEntry.value.image, set: (v: string) => { dialogEntry.value.image = v; } });
const dialogSe = computed({ get: () => dialogEntry.value.se, set: (v: string) => { dialogEntry.value.se = v; } });

/** 種類を画像にしたら、行送りは使えないので静止にする。 */
const onKindChange = () => {
	if (dialogEntry.value.kind !== 'テキスト' && dialogEntry.value.effect === '行送り') dialogEntry.value.effect = '静止';
};

const showAddDialog = () => {
	editingIndex.value = -1;
	dialogEntry.value = createEmptyEntry();
	dialogVisible.value = true;
};

const showEditDialog = (idx: number) => {
	editingIndex.value = idx;
	const entry = localConfig.value.entries[idx];
	dialogEntry.value = entry ? toDialog(entry) : createEmptyEntry();
	dialogVisible.value = true;
};

const closeDialog = () => {
	dialogVisible.value = false;
	editingIndex.value = -1;
};

const saveDialog = async () => {
	const saved = fromDialog(dialogEntry.value);
	if (editingIndex.value === -1) {
		form.edit('entries', (list) => { list.push(saved); });
	} else {
		const index = editingIndex.value;
		form.edit('entries', (list) => { list.splice(index, 1, saved); });
	}
	closeDialog();
};

const moveUp = async (idx: number) => {
	if (idx <= 0) return;
	form.edit('entries', (arr) => { [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; });
};

const moveDown = async (idx: number) => {
	if (idx >= localConfig.value.entries.length - 1) return;
	form.edit('entries', (arr) => { [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; });
};

const clip = (s: string) => (s.length > 30 ? `${s.slice(0, 30)}…` : s);
const titleOf = (e: Entry): string => {
	if (!e) return '';
	const name = (e as SequenceItem).name;
	const effect = isDescription.value ? '' : ` [${(e as SequenceItem).effect} ${(e as SequenceItem).seconds}秒]`;
	const body = name || (e.kind === 'テキスト' ? (e.text ? clip(e.text.replace(/\n/g, ' ')) : 'テキスト') : `画像${e.image ? ` (${e.image})` : ''}`);
	return `${body}${effect}`;
};

onBeforeUnmount(() => {
	eventBus.off('syncPulled', reloadAfterSync);
});

const selectedIndices = ref<number[]>([]);
const isAllSelected = computed({
	get: () => localConfig.value.entries.length > 0 && selectedIndices.value.length === localConfig.value.entries.length,
	set: (val: boolean) => { selectedIndices.value = val ? localConfig.value.entries.map((_, i) => i) : []; }
});

const deleteSelected = async () => {
	if (!selectedIndices.value.length) return;
	const sorted = [...selectedIndices.value].sort((a, b) => b - a);
	form.edit('entries', (list) => { for (const idx of sorted) list.splice(idx, 1); });
	selectedIndices.value = [];
	if (props.autoSaveOnDelete) await handleSaveClick();
};

const removeEntry = async (idx: number) => {
	form.edit('entries', (list) => { list.splice(idx, 1); });
	if (props.autoSaveOnDelete) await handleSaveClick();
};

const handleSaveClick = async () => {
	saving.value = true;
	saveStatus.value = '保存中...';
	try {
		await form.save(async (cfg) => {
			const payload = isDescription.value
				? toStoredDescription({ bgm: cfg.bgm || '', pages: cfg.entries as DescriptionPage[] })
				: toStoredSequence({ bgm: cfg.bgm || '', items: cfg.entries as SequenceItem[] });
			// 選んだばかりのファイルは、設定が参照している名前の分だけ、設定と一緒に保存する(素材の索引は保存のたびに作り直される)
			const files = draft.filesFor([payload.bgm, ...mediaNamesOf(cfg.entries)]);
			await screenSettingsService.saveScreenSetting(props.screenName, props.settingName, payload, files);
		});
		await draft.reload();
		saveStatus.value = '保存しました';
	} catch (err) {
		console.error(`Failed to save ${props.screenName} config`, err);
		saveStatus.value = '保存に失敗しました';
	} finally {
		saving.value = false;
	}
};
</script>

<style scoped>
.status-text {
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #cfd6dd);
}

.screen-config {
	margin-bottom: 12px;
	min-width: 0;
}

.screen-config h3 {
	margin-bottom: 16px;
	color: var(--ui-text, #fff);
}

.config-item {
	margin-bottom: 12px;
}

.section-hint,
.field-hint {
	color: var(--ui-text-muted, #cfd6dd);
	font-size: var(--ui-font-sm, 0.875rem);
	margin: 0 0 12px;
}

.field-hint {
	margin: -4px 0 0;
}

.field-col {
	display: flex;
	flex-direction: column;
	gap: 4px;
	flex: 1;
}

.config-item label {
	display: block;
	margin-bottom: 8px;
	font-weight: bold;
	color: var(--ui-text, #fff);
}

.admin-input {
	padding: 10px 16px;
	border-radius: 8px;
	border: none;
	background: var(--ui-surface, #2b3036);
	color: var(--ui-text, #fff);
	font-size: var(--ui-font-md, 1rem);
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	margin-bottom: 12px;
	width: 100%;
	box-sizing: border-box;
	max-width: 100%;
	overflow-wrap: anywhere;
}

.admin-input:focus {
	outline: 2px solid #4f8cff;
}

.content-list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.select-all-row {
	margin-bottom: 10px;
	display: flex;
	align-items: center;
}

.select-checkbox,
.row-checkbox {
	width: 20px;
	height: 20px;
	accent-color: #4f8cff;
}

.content-list-item {
	display: grid;
	grid-template-columns: 36px 1fr auto;
	gap: 12px;
	align-items: center;
	padding: 14px;
	background: #222831;
	border-radius: 8px;
}

.content-summary {
	display: flex;
	align-items: center;
	gap: 12px;
	color: var(--ui-text, #fff);
}

.content-list-actions {
	display: flex;
	gap: 8px;
	align-items: center;
}

.button-row {
	display: flex;
	gap: 12px;
	margin-top: 12px;
	flex-wrap: wrap;
}

.content-controls {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.content-row {
	display: flex;
	gap: 12px;
}

.empty-note {
	color: #cbd5e1;
	font-size: var(--ui-font-sm, 0.875rem);
	margin-bottom: 8px;
}

.config-item {
	min-width: 0;
}
</style>
