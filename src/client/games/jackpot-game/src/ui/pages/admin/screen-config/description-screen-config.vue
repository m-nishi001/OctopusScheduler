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
			</div>
			<div style="display:flex;align-items:center;gap:12px;">
				<button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving"
					:style="{ opacity: saving ? 0.6 : 1 }">保存</button>
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
	loading,
	loadingStatus,
	saving,
	saveStatus,
	handleSave,
} = useScreenSettingData();

const localConfig = ref({
	descriptionBgm: "",
});

const loadConfig = async () => {
	try {
		const config = await screenConfigService.fetchScreenConfig("description");
		if (config) {
			localConfig.value.descriptionBgm = (config as any).descriptionBgm || "";
		}
	} catch (error) {
		console.error("Failed to load description config:", error);
	}
}; onMounted(async () => {
	await loadConfig();
});

const handleSaveClick = async () => {
	await handleSave(async () => {
		const config = new DescriptionScreenSetting(
			localConfig.value.descriptionBgm,
			[]
		);
		const converter = container.resolve(DescriptionScreenConfigConverter);
		const settings = converter.toSettings(config);
		await screenConfigService.saveScreenConfigs(settings);
		await loadConfig();
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

.slide-item {
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
