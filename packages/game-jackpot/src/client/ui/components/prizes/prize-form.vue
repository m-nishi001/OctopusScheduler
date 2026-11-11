<template>
  <div class="prize-form">
    <div class="form-grid">
      <div class="basic-fields">
        <div class="name-field">
          <FieldText v-model="formData.name" label="名前" placeholder="景品名" />
        </div>
        <div class="weight-field">
          <FieldNumberStepper v-model="formData.rank" :min="MIN_PRIZE_RANK" :max="MAX_PRIZE_RANK" label="景品ランク（1〜5、標準3、5=豪華でレア）" />
          <p class="rank-hint">ランクが高いほど豪華でレア（当選しにくい）。</p>
          <p class="odds-preview">このプールでの当選確率: 約{{ oddsPreviewPercent }}%</p>
        </div>
        <div class="animation-field">
          <FieldSelect v-model="formData.animation" :options="animationOptions" label="抽選アニメーション" />
        </div>
      </div>

      <div class="kakuhen-field" data-testid="kakuhen-field">
        <label class="kakuhen-check">
          <input type="checkbox" v-model="formData.kakuhen" data-testid="kakuhen-checkbox" />
          <span>確変対応あり</span>
        </label>
        <p class="kakuhen-hint">
          ONにすると確変ターンで『当たり…だが！』のフェイク演出に使われます。1枚目＝フェイク、2枚目＝本当の結果。
          OFFの間は、確変_抽選画像・確変_当選画像・確変_当選BGMは使えません（入力済みの内容は消さずに残しますが、抽選・演出では使いません）。
        </p>
      </div>

      <div v-for="slot in IMAGE_SLOTS" :key="slot.field" :class="[slot.area, { 'kakuhen-dep': slot.second }]">
        <MediaPicker :label="slot.label" kind="image" v-model="formData[slot.field]" :options="draft.optionsOf('image')"
          :disabled="slot.second && !formData.kakuhen"
          :preview-url="draft.urlOf(formData[slot.field])" @pick="draft.pick" />
      </div>

      <div class="bgm-actions">
        <div v-for="slot in BGM_SLOTS" :key="slot.field" :class="{ 'kakuhen-dep': slot.second }">
          <MediaPicker :label="slot.label" kind="audio"
            v-model="formData[slot.field]" :options="draft.optionsOf('audio')"
            :disabled="slot.second && !formData.kakuhen"
            :preview-url="draft.urlOf(formData[slot.field])" @pick="draft.pick" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import FieldText from '../../../ui/pages/admin/prizes/components/field-text.vue';
import FieldNumberStepper from '../../../ui/pages/admin/prizes/components/field-number-stepper.vue';
import FieldSelect from '../../../ui/pages/admin/prizes/components/field-select.vue';
import MediaPicker from '../media-picker.vue';
import { useMediaDraft } from '@ui/composables/use-media-draft';
import type { Prize, PrizeFields } from '@model/prize/prize';
import { isKakuhenPrize } from '@model/prize/prize-kakuhen';
import { DEFAULT_PRIZE_RANK, MAX_PRIZE_RANK, MIN_PRIZE_RANK, prizeRankToWeight } from '@model/prize/prize-rank';

/** 景品の素材欄(画像4つ・BGM2つ)。どの項目に入るか・表示名・画面上の位置。 */
type MediaField = 'image' | 'image2' | 'winningImage1' | 'winningImage2' | 'bgm1' | 'bgm2';
const IMAGE_SLOTS: { field: MediaField; label: string; area: string; second?: boolean }[] = [
  { field: 'image', label: '抽選画像', area: 'image1-preview' },
  { field: 'image2', label: '確変_抽選画像', area: 'image2-section', second: true },
  { field: 'winningImage1', label: '当選画像', area: 'winning-image1-section' },
  { field: 'winningImage2', label: '確変_当選画像', area: 'winning-image2-section', second: true },
];
const BGM_SLOTS: { field: MediaField; label: string; second?: boolean }[] = [
  { field: 'bgm1', label: '当選BGM' },
  { field: 'bgm2', label: '確変_当選BGM', second: true },
];
const MEDIA_FIELDS = [...IMAGE_SLOTS, ...BGM_SLOTS].map((s) => s.field);

const props = defineProps({
  mode: { type: String as () => 'add' | 'edit', required: true },
  prize: { type: Object, default: null },
  /** 当選確率プレビュー(景品ランクから求めた重みで計算)のための、このプール内の他の景品(編集中の景品自身は除く)。 */
  otherPrizes: { type: Array as () => Prize[], default: () => [] },
});

const emit = defineEmits<{
  /** 保存する項目と、選んだばかりの素材(名前 → ファイル)。 */
  submit: [payload: { fields: PrizeFields; files: Map<string, File> }];
  cancel: [];
}>();

const draft = useMediaDraft();

const animationOptions = [
  { value: 'roulette', label: 'ルーレット' },
  { value: 'slot', label: 'スロット' },
];

type FormData = { name: string; rank: number; animation: string; kakuhen: boolean } & Record<MediaField, string>;

const emptyFormData = (): FormData => ({
  name: '',
  rank: DEFAULT_PRIZE_RANK,
  animation: 'roulette',
  kakuhen: false,
  image: '',
  image2: '',
  bgm1: '',
  bgm2: '',
  winningImage1: '',
  winningImage2: '',
});
const formData = ref<FormData>(emptyFormData());

// 参照している素材のプレビューを用意する(登録済みの素材の一覧も読む)
draft.track(() => MEDIA_FIELDS.map((f) => formData.value[f]));
onMounted(() => void draft.reload());

const isValid = computed(() => formData.value.name.trim());

// このプール内の他の景品(編集中の景品自身を除く)に対する当選確率のプレビュー。
const oddsPreviewPercent = computed(() => {
  const currentId = props.mode === 'edit' && props.prize ? props.prize.id : undefined;
  const othersTotalWeight = props.otherPrizes
    .filter((p) => p.id !== currentId)
    .reduce((sum, p) => sum + prizeRankToWeight(p.rank), 0);
  const currentWeight = prizeRankToWeight(formData.value.rank);
  const totalWeight = othersTotalWeight + currentWeight;
  if (totalWeight <= 0) return '0.0';
  return ((currentWeight / totalWeight) * 100).toFixed(1);
});

// 親のダイアログのフッターのボタンから呼べるようにする
defineExpose({ submit, cancel });

watch(() => props.prize, (val) => {
  if (val && props.mode === 'edit') loadPrize(val as Prize);
}, { immediate: true });

function loadPrize(prize: Prize) {
  formData.value = {
    ...emptyFormData(),
    name: prize.name,
    rank: prize.rank ?? DEFAULT_PRIZE_RANK,
    animation: prize.animation || 'roulette',
    kakuhen: isKakuhenPrize(prize),
    ...Object.fromEntries(MEDIA_FIELDS.map((f) => [f, prize[f] || ''])),
  };
}

function submit() {
  if (!isValid.value) return;
  const { name, rank, animation, kakuhen } = formData.value;
  const media = Object.fromEntries(MEDIA_FIELDS.map((f) => [f, formData.value[f] || undefined]));
  emit('submit', {
    fields: { name, rank, animation, kakuhen, ...media },
    files: draft.filesFor(MEDIA_FIELDS.map((f) => formData.value[f])),
  });
}

function cancel() {
  emit('cancel');
}
</script>

<style scoped>
.prize-form {
  overflow-x: hidden;
  /* Let the dialog's scrolling container handle vertical scrolling to avoid nested scrollbars */
  overflow-y: visible;
  box-sizing: border-box;
  padding-bottom: 40px;
}


.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* 5 rows: basic-fields / animation (handled inside basic) / images / winning images / bgm */
  grid-template-rows: auto auto auto auto auto;
  gap: 20px;
  padding: 20px;
  min-width: 0;
  min-height: 0;
}

/* 確変対応のチェックと、それに連動する2枚目の欄(確変_抽選画像・確変_当選画像・確変_当選BGM)。連動する欄は点線の枠でまとめる */
.kakuhen-field {
  grid-column: 1 / -1;
  grid-row: 2;
}

.kakuhen-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  cursor: pointer;
}

.kakuhen-hint {
  margin: 4px 0 0;
  font-size: 0.85em;
  color: #666;
}

.kakuhen-dep {
  border: 1px dashed var(--ui-border, #3a4048);
  border-radius: 8px;
  padding: 8px;
  min-width: 0;
}

/* ensure grid can shrink and children don't force overflow */
.basic-fields,
.image1-preview,
.image2-section,
.winning-image1-section,
.winning-image2-section,
.bgm-actions {
  min-width: 0;
}

.basic-fields {
  grid-column: 1 / -1;
  grid-row: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.basic-fields>.name-field {
  grid-column: 1;
}

.basic-fields>.weight-field {
  grid-column: 2;
}

.rank-hint {
  margin: 4px 0 0;
  font-size: 0.85em;
  color: #666;
}

.odds-preview {
  margin: 4px 0 0;
  font-size: 0.85em;
  color: #666;
}

.basic-fields>.animation-field {
  grid-column: 1 / -1;
  margin-top: 8px;
}

.image1-preview {
  grid-column: 1;
  grid-row: 3;
}

.image2-section {
  grid-column: 2;
  grid-row: 3;
}

.winning-image1-section {
  grid-column: 1;
  grid-row: 4;
}

.winning-image2-section {
  grid-column: 2;
  grid-row: 4;
}

.bgm-actions {
  grid-column: 1 / -1;
  grid-row: 5;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.preview-box {
  width: 100%;
  max-width: 220px;
  aspect-ratio: 1 / 1;
  border: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.placeholder {
  color: #999;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.bgm-actions>.actions {
  grid-column: 1 / -1;
}

/* sticky footer within the scrolling form */
.actions {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0));
  padding-top: 12px;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(5, auto);
  }

  .basic-fields {
    grid-template-columns: 1fr;
  }

  .bgm-actions {
    grid-template-columns: 1fr;
  }

  .preview-box {
    max-width: 100%;
  }
}
</style>