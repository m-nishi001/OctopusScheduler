<template>
    <div class="form-group">
        <label>BGM</label>
        <input type="file" accept="audio/*" @change="onBgmChange" />
        <audio v-if="bgmPreview" :src="bgmPreview" controls class="audio-preview"></audio>
    </div>
    <div class="form-group">
        <label>正解表示BGM</label>
        <input type="file" accept="audio/*" @change="onCorrectBgmChange" />
        <audio v-if="correctBgmPreview" :src="correctBgmPreview" controls class="audio-preview"></audio>
    </div>
    <div class="form-group">
        <label>当選景品名</label>
        <input v-model="prizeName" type="text" />
    </div>
    <div class="form-group">
        <label>当選景品画像</label>
        <input type="file" accept="image/*" @change="onPrizeImageChange" />
        <img v-if="prizeImagePreview" :src="prizeImagePreview" alt="景品画像プレビュー" class="image-preview" />
    </div>
    <div class="form-group">
        <label>当選景品BGM</label>
        <input type="file" accept="audio/*" @change="onPrizeBgmChange" />
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
.audio-preview {
    margin-top: var(--ui-space-2, 8px);
    width: 100%;
    max-width: 300px;
}

.image-preview {
    display: block;
    margin-top: var(--ui-space-2, 8px);
    max-width: 200px;
    max-height: 200px;
    object-fit: contain;
    border-radius: var(--ui-radius, 6px);
    border: 1px solid var(--ui-border, #3a4048);
}
</style>
