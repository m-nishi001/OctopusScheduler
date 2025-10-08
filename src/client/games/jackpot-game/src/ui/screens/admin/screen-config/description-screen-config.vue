<template>
	<div class="screen-config">
		<h3>説明画面設定</h3>
		<div class="config-item">
			<label>スライド:</label>
			<div v-for="(slide, idx) in config.slides" :key="idx" class="slide-item">
				<div style="display:flex;gap:8px;align-items:flex-start;">
					<div class="editor-container">
						<textarea v-model="slide.html" class="html-editor" placeholder="HTMLコンテンツを入力"></textarea>
						<div class="preview" v-html="resolveHtml(slide.html)"></div>
					</div>
					<div style="display:flex;flex-direction:column;gap:8px;min-width:180px">
						<label style="color:#fff">アセット挿入</label>
						<select v-model="selectedAssetForInsert[idx]" class="admin-input">
							<option value="">選択してください</option>
							<option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}
							</option>
						</select>
						<button class="admin-btn" @click="insertAsset(idx)">挿入</button>
						<div style="text-align:center;color:#fff;">または</div>
						<input type="file" @change="(e) => onUploadAndInsert(e, idx)" accept="image/*,video/*,audio/*"
							class="admin-input" />
					</div>
				</div>
				<div class="asset-mode">
					<label><input type="radio" v-model="slide.imageMode" value="select" /> 背景画像選択</label>
					<label><input type="radio" v-model="slide.imageMode" value="upload" /> 背景画像アップロード</label>
				</div>
				<select v-if="slide.imageMode === 'select'" v-model="slide.imageAssetId" class="admin-input">
					<option value="">選択なし</option>
					<option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
				</select>
				<input v-if="slide.imageMode === 'upload'" type="file" @change="(e) => onImageChange(e, idx)"
					accept="image/*" class="admin-input" />
				<div class="asset-mode">
					<label><input type="radio" v-model="slide.bgmMode" value="select" /> BGM選択</label>
					<label><input type="radio" v-model="slide.bgmMode" value="upload" /> BGMアップロード</label>
				</div>
				<select v-if="slide.bgmMode === 'select'" v-model="slide.bgmAssetId" class="admin-input">
					<option value="">選択なし</option>
					<option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
				</select>
				<input v-if="slide.bgmMode === 'upload'" type="file" @change="(e) => onBgmChange(e, idx)"
					accept="audio/*" class="admin-input" />
				<select v-model="slide.effect" class="admin-input">
					<option value="fade">フェード</option>
					<option value="zoom">ズーム</option>
				</select>
				<input v-model.number="slide.duration" type="number" placeholder="表示時間(ms)" class="admin-input" />
				<button class="admin-btn" @click="removeSlide(idx)">削除</button>
			</div>
			<button class="admin-btn" @click="addSlide">スライド追加</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, defineEmits, watch, onMounted } from 'vue';

const props = defineProps<{
	audioAssets: any[];
	imageAssets: any[];
	assetService: any;
	config?: any;
}>();

const emit = defineEmits<{
	update: [config: any];
	uploading: [isUploading: boolean];
}>();

// props.config が存在すればディープコピーし、なければ空の slides 配列を持つオブジェクトを初期値とする
const config = ref(props.config ? JSON.parse(JSON.stringify(props.config)) : { slides: [] as any[] });

const selectedAssetForInsert = ref<string[]>([]);

const assets = ref<any[]>([]);

onMounted(async () => {
	assets.value = await props.assetService.fetchAssets();
});

watch(() => props.config, (newCfg: any) => {
	config.value = newCfg ? JSON.parse(JSON.stringify(newCfg)) : { slides: [] };
	selectedAssetForInsert.value = new Array(config.value.slides.length).fill('');
}, { deep: true });

watch(config, (newVal: any) => {
	try {
		const normalizedProp = props.config ? JSON.parse(JSON.stringify(props.config)) : undefined;
		const plainNewVal = JSON.parse(JSON.stringify(newVal));
		if (JSON.stringify(normalizedProp) !== JSON.stringify(plainNewVal)) {
			emit('update', plainNewVal);
		}
	} catch (e) {
		emit('update', JSON.parse(JSON.stringify(newVal)));
	}
}, { deep: true });

const resolveHtml = (html: string) => {
	if (!html || typeof html !== 'string') return html;
	const assetMap = new Map(assets.value.map((a: any) => [a.id, a]));
	return html.replace(
		/\{asset:([a-zA-Z0-9_-]+)\}/g,
		(_m: string, aid: string) => {
			const a = assetMap.get(aid);
			if (!a) return '';
			if (a.type === 'image') return `<img src="${a.dataUrl}" alt="${a.name}" />`;
			if (a.type === 'video') return `<video src="${a.dataUrl}" controls></video>`;
			if (a.type === 'audio') return `<audio src="${a.dataUrl}" controls></audio>`;
			return '';
		}
	);
};

const insertAsset = (idx: number) => {
	const assetId = selectedAssetForInsert.value[idx];
	if (assetId) {
		const asset = props.imageAssets.find((a: any) => a.id === assetId);
		if (asset) {
			const imgTag = `<p>"{asset:${asset.id}}"</p>`;
			config.value.slides[idx].html += imgTag;
		}
	}
};

const onImageChange = async (e: Event, idx: number) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		emit('uploading', true);
		try {
			const result = await props.assetService.addAssets([file]);
			if (result.successful.length > 0) {
				config.value.slides[idx].imageAssetId = result.successful[0].id;
				// update は watch によって自動的に行われる
			}
		} catch (error) {
			console.error('Failed to upload image:', error);
		} finally {
			emit('uploading', false);
		}
	}
};

const onBgmChange = async (e: Event, idx: number) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		emit('uploading', true);
		try {
			const result = await props.assetService.addAssets([file]);
			if (result.successful.length > 0) {
				config.value.slides[idx].bgmAssetId = result.successful[0].id;
				// update は watch によって自動的に行われる
			}
		} catch (error) {
			console.error('Failed to upload BGM:', error);
		} finally {
			emit('uploading', false);
		}
	}
};

const onUploadAndInsert = async (e: Event, idx: number) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		emit('uploading', true);
		try {
			const result = await props.assetService.addAssets([file]);
			if (result.successful.length > 0) {
				const asset = result.successful[0];
				// プレースホルダー形式でHTMLタグを挿入
				const imgTag = `<p><img src="{asset:${asset.id}}" alt="${asset.name}" /></p>`;
				// TinyMCE のエディタに挿入
				// ここでは直接挿入できないので、v-model で更新
				config.value.slides[idx].html += imgTag;
			}
		} catch (error) {
			console.error('Failed to upload and insert asset:', error);
		} finally {
			emit('uploading', false);
		}
	}
};

const addSlide = () => {
	config.value.slides.push({
		html: '<p>新しいスライドのコンテンツ</p>',
		imageMode: 'select',
		imageAssetId: '',
		bgmMode: 'select',
		bgmAssetId: '',
		effect: 'fade',
		duration: 5000,
	});
	// スライドが追加されたため、エディタ配列を再構築する (これは構造変更なので必須)
	selectedAssetForInsert.value.push('');
	// update は watch によって自動的に行われる
};

const removeSlide = (idx: number) => {
	config.value.slides.splice(idx, 1);
	selectedAssetForInsert.value.splice(idx, 1);
	// update は watch によって自動的に行われる
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
