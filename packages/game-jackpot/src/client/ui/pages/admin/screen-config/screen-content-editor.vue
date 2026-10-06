<template>
	<div class="screen-config">
		<h3>{{ title }}</h3>
		<div class="config-item">
			<label>BGM:</label>
			<div class="asset-mode">
				<label><input type="radio" v-model="localConfig.bgmMode" value="select" /> 既存から選択</label>
				<label><input type="radio" v-model="localConfig.bgmMode" value="upload" /> アップロード</label>
			</div>
			<select v-if="localConfig.bgmMode === 'select'" v-model="localConfig.bgmAssetId" class="admin-input">
				<option value="">選択なし</option>
				<option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
			</select>
			<input v-if="localConfig.bgmMode === 'upload'" type="file" @change="onBgmChange" accept="audio/*"
				class="admin-input" />
		</div>

		<div class="config-item">
			<label>コンテンツ:</label>
			<UiToolbar>
				<UiButton variant="primary" icon="add" @click="showAddDialog">追加</UiButton>
				<UiButton variant="danger" icon="delete" :disabled="!selectedIndices.length"
					@click="deleteSelectedContents">選択削除</UiButton>
			</UiToolbar>

			<div class="select-all-row">
				<input type="checkbox" class="select-checkbox" v-model="isAllSelected" />
			</div>

			<div v-if="localConfig.contents.length === 0" class="empty-note">コンテンツがありません。追加してください。</div>

			<ul class="content-list">
				<li v-for="(content, idx) in localConfig.contents" :key="idx" class="content-list-item">
					<div class="select-col">
						<input type="checkbox" class="row-checkbox" :value="idx" v-model="selectedIndices" />
					</div>
					<div class="content-summary">
						<span class="content-index">{{ idx + 1 }}.</span>
						<span class="content-title">{{ getContentTitle(content) }}</span>
					</div>
					<div class="content-list-actions">
						<UiButton @click="showEditDialog(idx)">詳細</UiButton>
						<UiButton variant="danger" @click="removeContent(idx)">削除</UiButton>
						<UiButton @click="moveUp(idx)" :disabled="idx === 0">↑</UiButton>
						<UiButton @click="moveDown(idx)" :disabled="idx === localConfig.contents.length - 1">↓</UiButton>
					</div>
				</li>
			</ul>
		</div>

		<UiBusyOverlay :visible="saving" title="保存中..." :message="saveStatus" />

		<UiDialog :model-value="dialogVisible" :title="editingIndex === -1 ? 'コンテンツを追加' : 'コンテンツを編集'" size="md"
			nested :close-on-overlay="false" confirm-label="保存" @confirm="saveDialog" @close="closeDialog">
				<div class="content-controls form-group">
					<label>コンテンツ名</label>
					<input v-model="(dialogContent as any).name" placeholder="コンテンツ名" />

					<select v-model="dialogContent.type">
						<option value="text">テキスト</option>
						<option value="image">画像</option>
						<option value="html">HTML</option>
					</select>

					<input v-if="dialogContent.type === 'text'" v-model="dialogContent.text" placeholder="テキスト内容" />

					<textarea v-if="dialogContent.type === 'html'" v-model="dialogContent.content" placeholder="HTMLを入力" rows="6"></textarea>

					<div v-if="dialogContent.type === 'image'">
						<div class="asset-mode">
							<label><input type="radio" v-model="dialogContent.imageMode" value="select" />
								既存から選択</label>
							<label><input type="radio" v-model="dialogContent.imageMode" value="upload" />
								アップロード</label>
						</div>
						<select v-if="dialogContent.imageMode === 'select'" v-model="dialogContent.assetId">
							<option value="">選択なし</option>
							<option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}
							</option>
						</select>
						<input v-if="dialogContent.imageMode === 'upload'" type="file" @change="onDialogImageChange"
							accept="image/*" />
					</div>

					<div class="content-row">
						<select v-model="dialogContent.effect">
							<option value="scroll">スクロール</option>
							<option value="fade">フェード</option>
							<option value="static">静止</option>
						</select>
						<input v-model.number="dialogContent.duration" type="number" placeholder="表示時間(ms)" />
					</div>

					<div class="asset-mode">
						<label><input type="radio" v-model="dialogContent.seMode" value="select" /> SE選択</label>
						<label><input type="radio" v-model="dialogContent.seMode" value="upload" /> SEアップロード</label>
					</div>
					<select v-if="dialogContent.seMode === 'select'" v-model="dialogContent.seAssetId">
						<option value="">選択なし</option>
						<option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
					</select>
					<input v-if="dialogContent.seMode === 'upload'" type="file" @change="onDialogSeChange"
						accept="audio/*" />
				</div>

		</UiDialog>

		<div style="display:flex;align-items:center;gap:12px;margin-top:24px;">
			<UiButton @click="handleSaveClick" :disabled="saving">保存</UiButton>
			<div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
		</div>

		<UnsavedChangesDialog :visible="showUnsavedDialog" @discard="discardChanges" @cancel="cancelNavigation" />
	</div>
</template>

<script setup lang="ts">
import { UiBusyOverlay, UiButton, UiDialog, UiToolbar } from '@octopus/ui-kit';
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { AssetDataService } from '@control/asset/asset-data-service';
import type { OpeningContent } from '@model/screen-config/opening-screen-setting';
import type { Asset } from "@model/asset/asset-data";
import UnsavedChangesDialog from './unsaved-changes-dialog.vue';
import { onBeforeRouteLeave } from 'vue-router';

/**
 * opening/description/ending の3画面設定フォームが持っていたほぼ同一の
 * 「BGM + コンテンツリスト編集」フォームを1つに集約したもの。screenName/
 * settingName/titleだけを画面ごとに渡す。autoSaveOnDeleteは、ending画面
 * のみ既存挙動として「削除操作で即保存する」動きだったため、その差異を
 * そのまま維持するために残したフラグ(他の2画面はfalseで、削除は
 * ローカル変更のみ→別途「保存」ボタンを押すまで確定しない)。
 */
const props = withDefaults(
	defineProps<{
		screenName: string;
		settingName: string;
		title: string;
		autoSaveOnDelete?: boolean;
	}>(),
	{ autoSaveOnDelete: false }
);

const screenSettingsService = container.resolve(ScreenSettingsService);
const assetService = container.resolve(AssetDataService);

const audioAssets = ref<any[]>([]);
const imageAssets = ref<any[]>([]);

const assetUrlMap = new Map<string, string>();
const saving = ref(false);
const saveStatus = ref('');

const hasUnsavedChanges = ref(false);
const showUnsavedDialog = ref(false);
const pendingRoute = ref<(() => void) | null>(null);

const localConfig = ref({
	bgmAssetId: "",
	bgmMode: "select",
	contents: [] as OpeningContent[],
});

const tempAssets: Asset[] = [];

const fetchAssets = async () => {
	try {
		const raw = await assetService.getAllAssetData();
		const mapped = raw.map((a: any) => {
			const copy: any = { ...a };
			if (!copy.url && copy.blob) {
				try {
					const url = URL.createObjectURL(copy.blob);
					copy.url = url;
					if (copy.id) assetUrlMap.set(copy.id, url);
				} catch (err) {
					console.error('Failed to create object URL for asset', err);
				}
			}
			return copy;
		});

		audioAssets.value = mapped.filter((m: any) => !!m?.type && m.type.startsWith('audio/'));
		imageAssets.value = mapped.filter((m: any) => !!m?.type && m.type.startsWith('image/'));
	} catch (e) {
		audioAssets.value = [];
		imageAssets.value = [];
	}
};

const loadConfig = async () => {
	try {
		const cfg = await screenSettingsService.fetchScreenSetting(props.screenName, props.settingName);
		if (cfg) {
			localConfig.value.bgmAssetId = (cfg as any).bgmAssetId || '';
			localConfig.value.bgmMode = 'select';
			localConfig.value.contents = (cfg as any).contents || (cfg as any).screenElements || [];
		}
	} catch (error) {
		console.error(`Failed to load ${props.screenName} config:`, error);
	}
};

onMounted(async () => {
	await Promise.all([loadConfig(), fetchAssets()]);
	hasUnsavedChanges.value = false; // 初期ロード後リセット
});

watch(localConfig, () => {
	hasUnsavedChanges.value = true;
}, { deep: true });

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
	tempAssets.length = 0; // アップロードアセットを破棄
	if (pendingRoute.value) {
		pendingRoute.value();
	}
};

const cancelNavigation = () => {
	showUnsavedDialog.value = false;
	pendingRoute.value = null;
};

const onBgmChange = async (e: Event) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		const dto = await assetService.createDriveDataDtoFromFile(file);
		tempAssets.push(dto);
		localConfig.value.bgmAssetId = dto.id;
	}
};

const dialogVisible = ref(false);
const editingIndex = ref<number>(-1);

const createEmptyContent = (): OpeningContent => ({
	type: 'text',
	name: '',
	text: '',
	content: '',
	imageMode: 'select',
	assetId: '',
	effect: 'scroll',
	duration: 3000,
	seMode: 'select',
	seAssetId: '',
} as OpeningContent);

const dialogContent = ref<OpeningContent>(createEmptyContent());

const showAddDialog = () => {
	editingIndex.value = -1;
	dialogContent.value = JSON.parse(JSON.stringify(createEmptyContent()));
	dialogVisible.value = true;
};

const showEditDialog = (idx: number) => {
	editingIndex.value = idx;
	dialogContent.value = JSON.parse(JSON.stringify(localConfig.value.contents[idx] || createEmptyContent()));
	dialogVisible.value = true;
};

const closeDialog = () => {
	dialogVisible.value = false;
	editingIndex.value = -1;
};

const saveDialog = async () => {
	if (editingIndex.value === -1) {
		localConfig.value.contents.push(JSON.parse(JSON.stringify(dialogContent.value)));
	} else {
		localConfig.value.contents.splice(editingIndex.value, 1, JSON.parse(JSON.stringify(dialogContent.value)));
	}
	closeDialog();
};

const onDialogImageChange = async (e: Event) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		const dto = await assetService.createDriveDataDtoFromFile(file);
		tempAssets.push(dto);
		(dialogContent.value as any).assetId = dto.id;
	}
};

const onDialogSeChange = async (e: Event) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		const dto = await assetService.createDriveDataDtoFromFile(file);
		tempAssets.push(dto);
		(dialogContent.value as any).seAssetId = dto.id;
	}
};

const moveUp = async (idx: number) => {
	if (idx <= 0) return;
	const arr = localConfig.value.contents;
	[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
};

const moveDown = async (idx: number) => {
	const arr = localConfig.value.contents;
	if (idx >= arr.length - 1) return;
	[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
};

const getContentTitle = (c: OpeningContent) => {
	if (!c) return '';
	if ((c as any).name) return (c as any).name;
	if (c.type === 'text') return c.text ? (c.text.length > 30 ? c.text.substr(0, 30) + '…' : c.text) : 'テキスト';
	if (c.type === 'image') return '画像' + (c.assetId ? ` (${c.assetId})` : '');
	if (c.type === 'html') return 'HTML';
	return '';
};

onBeforeUnmount(() => {
	for (const url of assetUrlMap.values()) {
		try {
			URL.revokeObjectURL(url);
		} catch (e) {
			/* ignore */
		}
	}
	assetUrlMap.clear();
});

const selectedIndices = ref<number[]>([]);
const isAllSelected = computed({
	get: () => localConfig.value.contents.length > 0 && selectedIndices.value.length === localConfig.value.contents.length,
	set: (val: boolean) => { selectedIndices.value = val ? localConfig.value.contents.map((_, i) => i) : []; }
});

const deleteSelectedContents = async () => {
	if (!selectedIndices.value.length) return;
	const sorted = [...selectedIndices.value].sort((a, b) => b - a);
	for (const idx of sorted) {
		localConfig.value.contents.splice(idx, 1);
	}
	selectedIndices.value = [];
	if (props.autoSaveOnDelete) await handleSaveClick();
};

const removeContent = async (idx: number) => {
	localConfig.value.contents.splice(idx, 1);
	if (props.autoSaveOnDelete) await handleSaveClick();
};

const handleSaveClick = async () => {
	saving.value = true;
	saveStatus.value = '保存中...';
	try {
		const uploads = tempAssets.length > 0 ? await assetService.addAssetData(tempAssets) : [];
		const payload = {
			bgmAssetId: localConfig.value.bgmAssetId || '',
			contents: localConfig.value.contents,
		};
		await screenSettingsService.saveScreenSetting(props.screenName, props.settingName, payload, uploads.length ? uploads : undefined);
		await loadConfig();
		await fetchAssets();
		saveStatus.value = '保存しました';
		hasUnsavedChanges.value = false;
	} catch (err) {
		console.error(`Failed to save ${props.screenName} config`, err);
		saveStatus.value = '保存に失敗しました';
	} finally {
		saving.value = false;
	}
};
</script>

<style scoped>
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

.asset-mode {
	display: flex;
	gap: 16px;
	margin-bottom: 16px;
	flex-wrap: wrap;
}

.asset-mode label {
	display: flex;
	align-items: center;
	gap: 8px;
	color: var(--ui-text, #fff);
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
