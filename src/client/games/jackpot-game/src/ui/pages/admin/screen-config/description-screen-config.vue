<template>
	<div class="admin-section">
		<h2>説明画面設定</h2>
		<div class="tab-content">
			<div class="screen-config">
				<h3>説明画面設定</h3>
				<div class="config-item">
					<label>説明BGM:</label>
					<select v-model="localConfig.descriptionBgm" class="admin-input">
						<option value="">選択なし</option>
						<option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
					</select>
				</div>
				<div class="config-item">
					<label>コンテンツ:</label>
					<div v-for="(element, idx) in localConfig.screenElements" :key="element.id" class="element-item">
						<select v-model="element.type" class="admin-input">
							<option value="text">テキスト</option>
							<option value="image">画像</option>
							<option value="html">HTML</option>
							<option value="modal">モーダル</option>
						</select>
						<textarea v-if="element.type === 'text' || element.type === 'html' || element.type === 'modal'"
							v-model="element.content" placeholder="内容" class="admin-input" rows="4"></textarea>
						<div v-if="element.type === 'image'">
							<div class="asset-mode">
								<label><input type="radio" v-model="element.imageMode" value="select" /> 既存から選択</label>
								<label><input type="radio" v-model="element.imageMode" value="upload" /> アップロード</label>
							</div>
							<select v-if="element.imageMode === 'select'" v-model="element.assetId" class="admin-input">
								<option value="">選択なし</option>
								<option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}
								</option>
							</select>
							<input v-if="element.imageMode === 'upload'" type="file"
								@change="(e) => onImageChange(e, idx)" accept="image/*" class="admin-input" />
						</div>
						<input v-model="element.style" placeholder="スタイル (CSS)" class="admin-input" />
						<button class="admin-btn" @click="removeElement(idx)">削除</button>
					</div>
					<button class="admin-btn" @click="addElement">コンテンツ追加</button>
				</div>
			</div>
			<div style="display:flex;align-items:center;gap:12px;">
				<button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving"
					:style="{ opacity: saving ? 0.6 : 1 }">保存</button>
				<button class="admin-btn mt-4" @click="handleSyncClick" :disabled="syncing"
					:style="{ opacity: syncing ? 0.6 : 1 }">同期</button>
				<div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
			</div>
			<!-- ロードモーダル -->
			<div v-if="loading" class="modal-overlay">
				<div class="modal-content">
					<h3>{{ loadingStatus || 'データを読み込み中...' }}</h3>
					<p>アセットを読み込んでいます。しばらくお待ちください。</p>
					<div class="spinner"></div>
				</div>
			</div>
			<!-- 保存モーダル -->
			<div v-if="saving" class="modal-overlay">
				<div class="modal-content">
					<h3>保存中...</h3>
					<p>{{ saveStatus }}</p>
					<div class="spinner"></div>
				</div>
			</div>
			<!-- 同期モーダル -->
			<div v-if="syncing" class="modal-overlay">
				<div class="modal-content">
					<h3>同期中...</h3>
					<p>{{ syncStatus }}</p>
					<div class="spinner"></div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useScreenSettingData } from './use-screen-setting-data';
import { DescriptionScreenSetting } from '../../../../model/domains/screen-config/description-screen-setting';
import { DescriptionScreenConfigConverter } from '../../../../model/applications/screen-config/description/description-screen-config-converter';
import { container } from 'tsyringe';

const {
	screenConfigService,
	audioAssets,
	imageAssets,
	assetService,
	onTempAssets,
	tempAssets,
	fetchAssets,
	loading,
	loadingStatus,
	saving,
	saveStatus,
	handleSave,
} = useScreenSettingData();

const syncing = ref(false);
const syncStatus = ref("");

const localConfig = ref({
	descriptionBgm: "",
	screenElements: [] as any[],
});

const loadConfig = async () => {
	try {
		const config = await screenConfigService.fetchScreenConfig("description");
		if (config) {
			localConfig.value.descriptionBgm = (config as any).descriptionBgm || "";
			localConfig.value.screenElements = (config as any).screenElements || [];
		}
	} catch (error) {
		console.error("Failed to load description config:", error);
	}
}; onMounted(async () => {
	await loadConfig();
});

const onImageChange = async (e: Event, idx: number) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		const tempAsset = await assetService.createAssetDtoFromFile(file);
		onTempAssets([tempAsset]);
		localConfig.value.screenElements[idx].assetId = tempAsset.id;
	}
};

const addElement = () => {
	localConfig.value.screenElements.push({
		id: `element-${Date.now()}`,
		type: 'text',
		content: '',
		imageMode: 'select',
		assetId: '',
		style: '',
	});
};

const removeElement = (idx: number) => {
	localConfig.value.screenElements.splice(idx, 1);
};

const handleSyncClick = async () => {
	syncing.value = true;
	syncStatus.value = "サーバーと同期中...";
	try {
		await screenConfigService.syncScreenConfigs();
		await loadConfig();
		syncStatus.value = "同期完了";
	} catch (error) {
		console.error("Failed to sync screen configs:", error);
		syncStatus.value = "同期に失敗しました";
	} finally {
		syncing.value = false;
	}
};

const handleSaveClick = async () => {
	await handleSave(async () => {
		const oldTempAssets = [...tempAssets.value];
		const tempAssetMap = new Map<string, string>();
		let updatedAssets: any[] = [];

		if (tempAssets.value.length > 0) {
			updatedAssets = await assetService.addAssets(tempAssets.value);
			updatedAssets.forEach((asset: any, index: number) => {
				tempAssetMap.set(oldTempAssets[index].id, asset.id);
			});
		}

		localConfig.value.screenElements.forEach(element => {
			if (element.assetId && tempAssetMap.has(element.assetId)) {
				element.assetId = tempAssetMap.get(element.assetId)!;
			}
		});

		const config = new DescriptionScreenSetting(
			localConfig.value.descriptionBgm,
			localConfig.value.screenElements
		);
		const converter = container.resolve(DescriptionScreenConfigConverter);
		const settings = converter.toSettings(config);
		await screenConfigService.saveScreenConfigs(settings);
		await loadConfig();

		if (tempAssets.value.length > 0) {
		}

		tempAssets.value = [];
		await fetchAssets();
	});
};
</script>

<style scoped>
.screen-config {
	margin-bottom: 24px;
}

.screen-config h3 {
	margin-bottom: 16px;
	color: #fff;
}

.config-item {
	margin-bottom: 24px;
}

.config-item label {
	display: block;
	margin-bottom: 8px;
	font-weight: bold;
	color: #fff;
}

.element-item {
	border: 1px solid #555;
	padding: 16px;
	margin-bottom: 16px;
	border-radius: 8px;
	background: #333;
}

.admin-input {
	padding: 10px 16px;
	border-radius: 8px;
	border: none;
	background: #232b36;
	color: #fff;
	font-size: 1rem;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	margin-bottom: 8px;
	width: 100%;
}

.admin-input:focus {
	outline: 2px solid #4f8cff;
}

.admin-btn {
	padding: 10px 24px;
	border-radius: 8px;
	border: none;
	background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
	color: #232b36;
	font-weight: bold;
	cursor: pointer;
	transition: background 0.2s;
}

.admin-btn:hover {
	background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.asset-mode {
	display: flex;
	gap: 16px;
	margin-bottom: 16px;
}

.asset-mode label {
	display: flex;
	align-items: center;
	gap: 8px;
	color: #fff;
}

/* Prevent inputs and flex children from causing horizontal overflow */
.admin-input {
	box-sizing: border-box;
	max-width: 100%;
	overflow-wrap: anywhere;
}

.asset-mode {
	flex-wrap: wrap;
}

.slide-item,
.config-item {
	min-width: 0;
}

.modal-overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
}

.modal-content {
	background: #232b36;
	color: #fff;
	padding: 28px;
	border-radius: 10px;
	text-align: center;
	box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
}

.spinner {
	margin: 16px auto;
	width: 40px;
	height: 40px;
	border: 4px solid #f3f3f3;
	border-top: 4px solid #4f8cff;
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	0% {
		transform: rotate(0deg);
	}

	100% {
		transform: rotate(360deg);
	}
}

.editor-container {
	flex: 1;
}

.html-editor {
	width: 100%;
	height: 200px;
	padding: 10px;
	border: 1px solid #555;
	border-radius: 8px;
	background: #232b36;
	color: #fff;
	font-family: monospace;
	font-size: 14px;
	box-sizing: border-box;
	resize: vertical;
}

.preview {
	margin-top: 16px;
	padding: 10px;
	border: 1px solid #555;
	border-radius: 8px;
	background: #1e262d;
	color: #fff;
	min-height: 100px;
}
</style>
