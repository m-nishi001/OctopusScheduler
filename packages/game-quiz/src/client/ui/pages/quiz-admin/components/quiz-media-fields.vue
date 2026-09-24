<template>
    <div class="form-group">
        <label class="form-label">BGM</label>
        <input type="file" accept="audio/*" @change="onBgmChange" class="form-input" />
        <audio v-if="bgmPreview" :src="bgmPreview" controls class="audio-preview"></audio>
    </div>
    <div class="form-group">
        <label class="form-label">正解表示BGM</label>
        <input type="file" accept="audio/*" @change="onCorrectBgmChange" class="form-input" />
        <audio v-if="correctBgmPreview" :src="correctBgmPreview" controls class="audio-preview"></audio>
    </div>
    <div class="form-group">
        <label class="form-label">当選景品名</label>
        <input v-model="prizeName" type="text" class="form-input" />
    </div>
    <div class="form-group">
        <label class="form-label">当選景品画像</label>
        <input type="file" accept="image/*" @change="onPrizeImageChange" class="form-input" />
        <img v-if="prizeImagePreview" :src="prizeImagePreview" alt="景品画像プレビュー" class="image-preview" />
    </div>
    <div class="form-group">
        <label class="form-label">当選景品BGM</label>
        <input type="file" accept="audio/*" @change="onPrizeBgmChange" class="form-input" />
        <audio v-if="prizeBgmPreview" :src="prizeBgmPreview" controls class="audio-preview"></audio>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { QuizDto } from '../../../../control/dto/quiz-dto';
import { useObjectUrlStore } from '../../../composables/use-object-url-store';

const props = defineProps<{
    currentQuiz: QuizDto;
}>();

// BGM/画像プレビュー用のobject URLを、キーごとに使い回して管理する。
// unmount時のURL失効も内部で自動的に行われる。
const objectUrlStore = useObjectUrlStore();

const bgmPreview = computed(() => objectUrlStore.ensure('bgm', props.currentQuiz.bgm));
const correctBgmPreview = computed(() =>
    objectUrlStore.ensure('correctBgm', props.currentQuiz.settings?.correctBgm)
);
const prizeImagePreview = computed(() =>
    objectUrlStore.ensure('prizeImage', props.currentQuiz.settings?.prizeImage)
);
const prizeBgmPreview = computed(() =>
    objectUrlStore.ensure('prizeBgm', props.currentQuiz.settings?.prizeBgm)
);

const prizeName = computed({
    get: () => props.currentQuiz.settings?.prizeName || '',
    set: (value: string) => {
        if (props.currentQuiz.settings) {
            props.currentQuiz.settings.prizeName = value;
        }
    }
});

const onBgmChange = (event: Event) => {
    props.currentQuiz.bgm = (event.target as HTMLInputElement).files?.[0] ?? null;
};

const onCorrectBgmChange = (event: Event) => {
    props.currentQuiz.settings!.correctBgm = (event.target as HTMLInputElement).files?.[0] ?? null;
};

const onPrizeImageChange = (event: Event) => {
    props.currentQuiz.settings!.prizeImage = (event.target as HTMLInputElement).files?.[0] ?? null;
};

const onPrizeBgmChange = (event: Event) => {
    props.currentQuiz.settings!.prizeBgm = (event.target as HTMLInputElement).files?.[0] ?? null;
};
</script>

<style scoped>
.form-group {
    display: flex;
    flex-direction: column;
}

.form-label {
    display: block;
    font-size: 0.875rem;
    /* text-sm */
    font-weight: bold;
    margin-bottom: 0.5rem;
    /* mb-2 */
    color: #d1d5db;
    /* text-gray-300 */
}

.form-input {
    width: 100%;
    padding: 0.5rem;
    /* p-2 */
    border: 1px solid #4b5563;
    /* border-gray-600 */
    border-radius: 0.25rem;
    /* rounded */
    font-family: inherit;
    background-color: #374151;
    /* bg-gray-700 */
    color: white;
}

.form-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px #3b82f6;
    /* focus:ring-2 focus:ring-blue-500 */
}

.audio-preview {
    margin-top: 0.5rem;
    width: 100%;
    max-width: 300px;
}

.image-preview {
    margin-top: 0.5rem;
    max-width: 200px;
    max-height: 200px;
    object-fit: contain;
    border-radius: 0.25rem;
    border: 1px solid #4b5563;
}
</style>
