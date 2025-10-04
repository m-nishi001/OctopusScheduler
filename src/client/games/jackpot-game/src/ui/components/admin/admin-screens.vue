<template>
  <div class="admin-section">
    <h2>画面設定</h2>
    <div class="tabs">
      <button v-for="tab in tabs" :key="tab.key" :class="['tab-button', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key">
        {{ tab.label }}
      </button>
    </div>
    <div class="tab-content">
      <HomeScreenConfig v-if="activeTab === 'home'" :audio-assets="audioAssets" :asset-service="assetService"
        :config="homeConfig" @update="updateHomeConfig" @uploading="onUploading" />
      <OpeningScreenConfig v-if="activeTab === 'opening'" :audio-assets="audioAssets" :image-assets="imageAssets"
        :asset-service="assetService" :config="openingConfig" @update="updateOpeningConfig" @uploading="onUploading" />
      <DescriptionScreenConfig v-if="activeTab === 'description'" :audio-assets="audioAssets"
        :image-assets="imageAssets" :asset-service="assetService" :config="descriptionConfig"
        @update="updateDescriptionConfig" @uploading="onUploading" />
      <DemoScreenConfig v-if="activeTab === 'demo'" :audio-assets="audioAssets" :members="members" :prizes="prizes"
        :asset-service="assetService" :config="demoConfig" @update="updateDemoConfig" />
      <MainScreenConfig v-if="activeTab === 'main'" :audio-assets="audioAssets" :asset-service="assetService"
        :config="mainConfig" @update="updateMainConfig" />
      <ResultScreenConfig v-if="activeTab === 'result'" :audio-assets="audioAssets" :asset-service="assetService"
        :config="resultConfig" @update="updateResultConfig" />
    </div>
    <div style="display:flex;align-items:center;gap:12px;">
      <button class="admin-btn mt-4" @click="saveConfigs" :disabled="saving || uploading || loading"
        :style="{ opacity: saving ? 0.6 : 1 }">保存</button>
      <div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
    </div>
    <!-- ロードモーダル -->
    <div v-if="loading" class="modal-overlay">
      <div class="modal-content">
        <h3>{{ loadingStatus || 'データを読み込み中...' }}</h3>
        <p>アセット、メンバー、景品、画面設定を読み込んでいます。しばらくお待ちください。</p>
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
    <!-- アップロードモーダル -->
    <div v-if="uploading" class="modal-overlay">
      <div class="modal-content">
        <h3>アセットをアップロード中...</h3>
        <p>ファイルをアップロードしています。しばらくお待ちください。</p>
        <div class="spinner"></div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { AssetService } from '../../../model/applications/asset-service';
import { MemberService } from '../../../model/applications/member-service';
import { PrizeService } from '../../../model/applications/prize-service';
import { ScreenConfigService } from '../../../model/applications/screen-config-service';
import { container } from 'tsyringe';
import HomeScreenConfig from './screens/HomeScreenConfig.vue';
import OpeningScreenConfig from './screens/OpeningScreenConfig.vue';
import DescriptionScreenConfig from './screens/DescriptionScreenConfig.vue';
import DemoScreenConfig from './screens/DemoScreenConfig.vue';
import MainScreenConfig from './screens/MainScreenConfig.vue';
import ResultScreenConfig from './screens/ResultScreenConfig.vue';

const assetService = container.resolve(AssetService);
const memberService = container.resolve(MemberService);
const prizeService = container.resolve(PrizeService);
const screenConfigService = container.resolve(ScreenConfigService);

const activeTab = ref('home');
const tabs = [
  { key: 'home', label: 'ホーム' },
  { key: 'opening', label: 'オープニング' },
  { key: 'description', label: '説明' },
  { key: 'demo', label: 'デモ抽選' },
  { key: 'main', label: '本抽選' },
  { key: 'result', label: '最終結果' },
];

const assets = ref<any[]>([]);
const members = ref<any[]>([]);
const prizes = ref<any[]>([]);

const fetchAssets = async () => {
  try {
    assets.value = await assetService.fetchAssets();
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    assets.value = [];
  }
};

const fetchMembers = async () => {
  try {
    members.value = await memberService.fetchMembers();
  } catch (error) {
    console.error('Failed to fetch members:', error);
    members.value = [];
  }
};

const fetchPrizes = async () => {
  try {
    prizes.value = await prizeService.fetchPrizes();
  } catch (error) {
    console.error('Failed to fetch prizes:', error);
    prizes.value = [];
  }
};

const loading = ref(false);
const loadingStatus = ref('');

const loadScreenConfigs = async () => {
  try {
    loadingStatus.value = '画面設定を読み込み中...';

    const screenTypes = ['home', 'opening', 'description', 'demo', 'main', 'result'];
    const configPromises = screenTypes.map(async (type) => {
      const config = await screenConfigService.fetchScreenConfig(type);
      return { type, config };
    });

    const results = await Promise.all(configPromises);

    for (const { type, config } of results) {
      if (type === 'home') {
        homeConfig.value = {
          id: config.id || '',
          bgmMode: config.bgmAssetId ? 'select' : 'select',
          bgmAssetId: config.bgmAssetId || '',
          buttonSeMode: 'select',
          buttonSeAssetId: config.seAssetIds?.[0] || '',
          progressSeMode: 'select',
          progressSeAssetId: config.seAssetIds?.[1] || '',
        };
      } else if (type === 'opening') {
        openingConfig.value = {
          id: config.id || '',
          bgmMode: config.bgmAssetId ? 'select' : 'select',
          bgmAssetId: config.bgmAssetId || '',
          displayMode: config.displayMode || 'list',
          contents: config.elements.map(el => ({
            id: el.id,
            type: el.type,
            text: el.content || '',
            content: el.content || '',
            assetId: el.assetId || '',
            imageMode: 'select',
            seMode: 'select',
            effect: el.animation?.type || 'fade',
            duration: el.animation?.duration || 1000,
            scrollDirection: el.animation?.scrollDirection || 'up',
            seAssetId: '',
          })),
        };
      } else if (type === 'description') {
        descriptionConfig.value = {
          id: config.id || '',
          slides: config.elements.map(el => ({
            id: el.id,
            html: el.content || '',
            imageAssetId: el.assetId || '',
            effect: el.animation?.type || 'fade',
            duration: el.animation?.duration || 1000,
            bgmAssetId: '',
          })),
        };
      } else if (type === 'demo') {
        demoConfig.value = {
          id: config.id || '',
          winnerMemberId: '',
          winnerPrizeId: '',
          bgmMode: config.bgmAssetId ? 'select' : 'select',
          bgmAssetId: config.bgmAssetId || '',
          seMode: 'select',
          seAssetId: config.seAssetIds?.[0] || '',
        };
      } else if (type === 'main') {
        mainConfig.value = {
          id: config.id || '',
          bgmMode: config.bgmAssetId ? 'select' : 'select',
          bgmAssetId: config.bgmAssetId || '',
          memberSeMode: 'select',
          memberSeAssetId: config.seAssetIds?.[0] || '',
          prizeStartSeMode: 'select',
          prizeStartSeAssetId: config.seAssetIds?.[1] || '',
          lotterySeMode: 'select',
          lotterySeAssetId: config.seAssetIds?.[2] || '',
          confirmSeMode: 'select',
          confirmSeAssetId: config.seAssetIds?.[3] || '',
          winnerSeMode: 'select',
          winnerSeAssetId: config.seAssetIds?.[4] || '',
          nextSeMode: 'select',
          nextSeAssetId: config.seAssetIds?.[5] || '',
          halfSeMode: 'select',
          halfSeAssetId: config.seAssetIds?.[6] || '',
          endSeMode: 'select',
          endSeAssetId: config.seAssetIds?.[7] || '',
        };
      } else if (type === 'result') {
        resultConfig.value = {
          id: config.id || '',
          bgmMode: config.bgmAssetId ? 'select' : 'select',
          bgmAssetId: config.bgmAssetId || '',
          scrollSeMode: 'select',
          scrollSeAssetId: config.seAssetIds?.[0] || '',
          highSeMode: 'select',
          highSeAssetId: config.seAssetIds?.[1] || '',
          lowSeMode: 'select',
          lowSeAssetId: config.seAssetIds?.[2] || '',
          fadeSeMode: 'select',
          fadeSeAssetId: config.seAssetIds?.[3] || '',
        };
      }
    }
  } catch (error) {
    console.error('Failed to load screen configs:', error);
  }
};

const audioAssets = computed(() => assets.value.filter(asset => asset.type === 'audio'));
const imageAssets = computed(() => assets.value.filter(asset => asset.type === 'image'));

// 各画面の設定
const homeConfig = ref({
  id: '',
  bgmMode: 'select',
  bgmAssetId: '',
  buttonSeMode: 'select',
  buttonSeAssetId: '',
  progressSeMode: 'select',
  progressSeAssetId: '',
});

const openingConfig = ref({
  id: '',
  bgmMode: 'select',
  bgmAssetId: '',
  displayMode: 'list',
  contents: [] as any[],
});

const descriptionConfig = ref({
  id: '',
  slides: [] as any[],
});

const demoConfig = ref({
  id: '',
  winnerMemberId: '',
  winnerPrizeId: '',
  bgmMode: 'select',
  bgmAssetId: '',
  seMode: 'select',
  seAssetId: '',
});

const mainConfig = ref({
  id: '',
  bgmMode: 'select',
  bgmAssetId: '',
  memberSeMode: 'select',
  memberSeAssetId: '',
  prizeStartSeMode: 'select',
  prizeStartSeAssetId: '',
  lotterySeMode: 'select',
  lotterySeAssetId: '',
  confirmSeMode: 'select',
  confirmSeAssetId: '',
  winnerSeMode: 'select',
  winnerSeAssetId: '',
  nextSeMode: 'select',
  nextSeAssetId: '',
  halfSeMode: 'select',
  halfSeAssetId: '',
  endSeMode: 'select',
  endSeAssetId: '',
});

const resultConfig = ref({
  id: '',
  bgmMode: 'select',
  bgmAssetId: '',
  scrollSeMode: 'select',
  scrollSeAssetId: '',
  highSeMode: 'select',
  highSeAssetId: '',
  lowSeMode: 'select',
  lowSeAssetId: '',
  fadeSeMode: 'select',
  fadeSeAssetId: '',
});

// 更新関数
const updateHomeConfig = (config: any) => {
  homeConfig.value = config;
};

const updateOpeningConfig = (config: any) => {
  openingConfig.value = config;
};

const updateDescriptionConfig = (config: any) => {
  descriptionConfig.value = config;
};

const updateDemoConfig = (config: any) => {
  demoConfig.value = config;
};

const updateMainConfig = (config: any) => {
  mainConfig.value = config;
};

const updateResultConfig = (config: any) => {
  resultConfig.value = config;
};

const onUploading = (isUploading: boolean) => {
  uploading.value = isUploading;
};

const saving = ref(false);
const saveStatus = ref('');
const uploading = ref(false);

const saveConfigs = async () => {
  saving.value = true;
  saveStatus.value = '画面設定を保存しています...';
  try {
    const configs = [
      {
        id: homeConfig.value.id,
        type: 'home' as const,
        bgmAssetId: homeConfig.value.bgmAssetId || undefined,
        seAssetIds: [homeConfig.value.buttonSeAssetId, homeConfig.value.progressSeAssetId].filter(id => id),
        backgroundStyle: '',
        elements: [],
      },
      {
        id: openingConfig.value.id,
        type: 'opening' as const,
        bgmAssetId: openingConfig.value.bgmAssetId || undefined,
        seAssetIds: openingConfig.value.contents.flatMap(content => content.seAssetId ? [content.seAssetId] : []),
        backgroundStyle: '',
        displayMode: openingConfig.value.displayMode || 'list',
        elements: openingConfig.value.contents.map(content => ({
          type: content.type as any,
          // unify: store HTML into `content` field so server/display uses single field
          content: content.type === 'html' ? content.content || content.text : content.text,
          assetId: content.assetId,
          animation: { type: content.effect as 'fade' | 'zoom' | 'scroll' | 'slide' | 'particle' | 'custom', duration: content.duration, scrollDirection: content.scrollDirection },
        })),
      },
      {
        id: descriptionConfig.value.id,
        type: 'description' as const,
        bgmAssetId: undefined,
        seAssetIds: descriptionConfig.value.slides.flatMap(slide => slide.bgmAssetId ? [slide.bgmAssetId] : []),
        backgroundStyle: '',
        elements: descriptionConfig.value.slides.map(slide => ({
          type: 'text' as const,
          content: slide.html,
          assetId: slide.imageAssetId,
          animation: { type: slide.effect as 'fade' | 'zoom' | 'scroll' | 'slide' | 'particle' | 'custom', duration: slide.duration },
        })),
      },
      {
        id: demoConfig.value.id,
        type: 'demo' as const,
        bgmAssetId: demoConfig.value.bgmAssetId || undefined,
        seAssetIds: demoConfig.value.seAssetId ? [demoConfig.value.seAssetId] : [],
        backgroundStyle: '',
        elements: [],
      },
      {
        id: mainConfig.value.id,
        type: 'main' as const,
        bgmAssetId: mainConfig.value.bgmAssetId || undefined,
        seAssetIds: [
          mainConfig.value.memberSeAssetId,
          mainConfig.value.prizeStartSeAssetId,
          mainConfig.value.lotterySeAssetId,
          mainConfig.value.confirmSeAssetId,
          mainConfig.value.winnerSeAssetId,
          mainConfig.value.nextSeAssetId,
          mainConfig.value.halfSeAssetId,
          mainConfig.value.endSeAssetId,
        ].filter(id => id),
        backgroundStyle: '',
        elements: [],
      },
      {
        id: resultConfig.value.id,
        type: 'result' as const,
        bgmAssetId: resultConfig.value.bgmAssetId || undefined,
        seAssetIds: [
          resultConfig.value.scrollSeAssetId,
          resultConfig.value.highSeAssetId,
          resultConfig.value.lowSeAssetId,
          resultConfig.value.fadeSeAssetId,
        ].filter(id => id),
        backgroundStyle: '',
        elements: [],
      },
    ];
    await screenConfigService.saveScreenConfigs(configs as any);
    saveStatus.value = '保存に成功しました';
    // small delay so user sees success
    await new Promise((r) => setTimeout(r, 800));
    saveStatus.value = '';
  } catch (error) {
    console.error('Failed to save configs:', error);
    saveStatus.value = '保存に失敗しました（ローカルにのみ保存されました）';
    // keep message for a short while
    await new Promise((r) => setTimeout(r, 1500));
    saveStatus.value = '';
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  loading.value = true;
  loadingStatus.value = 'データを読み込み中...';
  try {
    await assetService.syncAssetsWithGoogleDrive((message) => {
      loadingStatus.value = message;
    });

    const assetsPromise = fetchAssets();
    const membersPromise = fetchMembers();
    const prizesPromise = fetchPrizes();
    const configsPromise = loadScreenConfigs();

    await Promise.all([assetsPromise, membersPromise, prizesPromise, configsPromise]);
  } finally {
    loading.value = false;
    loadingStatus.value = '';
  }
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 32px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid #555;
}

.tab-button {
  padding: 12px 24px;
  border: none;
  background: #333;
  color: #ccc;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: background 0.2s, color 0.2s;
}

.tab-button.active {
  background: #4f8cff;
  color: #fff;
}

.tab-content {
  padding: 24px;
  background: #232b36;
  border-radius: 8px;
}

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

.content-item,
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

textarea.admin-input {
  resize: vertical;
  min-height: 100px;
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
</style>
