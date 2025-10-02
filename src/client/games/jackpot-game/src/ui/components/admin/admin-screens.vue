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
      <HomeScreenConfig v-if="activeTab === 'home'" :audio-assets="audioAssets" :config="homeConfig"
        @update="updateHomeConfig" />
      <OpeningScreenConfig v-if="activeTab === 'opening'" :audio-assets="audioAssets" :image-assets="imageAssets"
        :config="openingConfig" @update="updateOpeningConfig" />
      <DescriptionScreenConfig v-if="activeTab === 'description'" :audio-assets="audioAssets"
        :image-assets="imageAssets" :config="descriptionConfig" @update="updateDescriptionConfig" />
      <DemoScreenConfig v-if="activeTab === 'demo'" :audio-assets="audioAssets" :members="members" :prizes="prizes"
        :config="demoConfig" @update="updateDemoConfig" />
      <MainScreenConfig v-if="activeTab === 'main'" :audio-assets="audioAssets" :config="mainConfig"
        @update="updateMainConfig" />
      <ResultScreenConfig v-if="activeTab === 'result'" :audio-assets="audioAssets" :config="resultConfig"
        @update="updateResultConfig" />
    </div>
    <button class="admin-btn mt-4" @click="saveConfigs">保存</button>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { AssetService } from '../../../model/applications/asset-service';
import { MemberService } from '../../../model/applications/member-service';
import { PrizeService } from '../../../model/applications/prize-service';
import { ScreenConfigRepository } from '../../../model/infrastructures/repository/screen-config-repository';
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
const screenConfigRepository = container.resolve(ScreenConfigRepository);

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

const audioAssets = computed(() => assets.value.filter(asset => asset.type === 'audio'));
const imageAssets = computed(() => assets.value.filter(asset => asset.type === 'image'));

// 各画面の設定
const homeConfig = ref({
  bgmMode: 'select',
  bgmAssetId: '',
  buttonSeMode: 'select',
  buttonSeAssetId: '',
  progressSeMode: 'select',
  progressSeAssetId: '',
});

const openingConfig = ref({
  bgmMode: 'select',
  bgmAssetId: '',
  contents: [] as any[],
});

const descriptionConfig = ref({
  slides: [] as any[],
});

const demoConfig = ref({
  winnerMemberId: '',
  winnerPrizeId: '',
  bgmMode: 'select',
  bgmAssetId: '',
  seMode: 'select',
  seAssetId: '',
});

const mainConfig = ref({
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

const saveConfigs = async () => {
  try {
    const configs = [
      {
        type: 'home' as const,
        bgmAssetId: homeConfig.value.bgmAssetId || undefined,
        seAssetIds: [homeConfig.value.buttonSeAssetId, homeConfig.value.progressSeAssetId].filter(id => id),
        backgroundStyle: '',
        elements: [],
      },
      {
        type: 'opening' as const,
        bgmAssetId: openingConfig.value.bgmAssetId || undefined,
        seAssetIds: openingConfig.value.contents.flatMap(content => content.seAssetId ? [content.seAssetId] : []),
        backgroundStyle: '',
        elements: openingConfig.value.contents.map(content => ({
          id: Math.random().toString(),
          type: (content.type === 'text' ? 'text' : 'image') as 'text' | 'image',
          content: content.text,
          assetId: content.assetId,
          animation: { type: content.effect as 'fade' | 'zoom' | 'scroll' | 'slide' | 'particle' | 'custom', duration: content.duration },
        })),
      },
      {
        type: 'description' as const,
        bgmAssetId: undefined,
        seAssetIds: descriptionConfig.value.slides.flatMap(slide => slide.bgmAssetId ? [slide.bgmAssetId] : []),
        backgroundStyle: '',
        elements: descriptionConfig.value.slides.map(slide => ({
          id: Math.random().toString(),
          type: 'text' as const,
          content: slide.html,
          assetId: slide.imageAssetId,
          animation: { type: slide.effect as 'fade' | 'zoom' | 'scroll' | 'slide' | 'particle' | 'custom', duration: slide.duration },
        })),
      },
      {
        type: 'demo' as const,
        bgmAssetId: demoConfig.value.bgmAssetId || undefined,
        seAssetIds: demoConfig.value.seAssetId ? [demoConfig.value.seAssetId] : [],
        backgroundStyle: '',
        elements: [],
      },
      {
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
    await screenConfigRepository.saveScreenConfigs(configs);
    alert('設定を保存しました');
  } catch (error) {
    console.error('Failed to save configs:', error);
    alert('保存に失敗しました');
  }
};

onMounted(() => {
  fetchAssets();
  fetchMembers();
  fetchPrizes();
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

.mt-4 {
  margin-top: 16px;
}
</style>
