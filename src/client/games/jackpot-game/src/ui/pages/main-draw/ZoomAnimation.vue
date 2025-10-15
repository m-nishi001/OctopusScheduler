<template>
    <div class="zoom-animation">
        <div class="prize-item" ref="prize" v-if="selectedPrize">
            <img :src="selectedPrize.imageAssetId" :alt="selectedPrize.name" />
            <p>{{ selectedPrize.name }}</p>
        </div>
        <div v-if="bonusMode === 'switch' && showBonus" class="bonus-text">ボーナス！</div>
        <div v-if="bonusMode === 'mirage' && showBonus" class="mirage-text">ミラージュ</div>
    </div>
</template>

<script lang="ts">
import { ref, watch } from 'vue';
import gsap from 'gsap';
import type { PrizeDto } from '../../../model/applications/prize/dto/prize-dto';

export default {
    name: 'ZoomAnimation',
    props: {
        selectedPrize: { type: Object as () => PrizeDto | null, default: null },
        bonusPrize: { type: Object as () => PrizeDto | null, default: null },
        bonusMode: { type: String, default: null },
        showResult: { type: Boolean, default: false },
        showBonus: { type: Boolean, default: false }
    },
    setup(props) {
        const prize = ref<HTMLElement | null>(null);

        watch(() => props.showResult, () => {
            if (props.showResult && prize.value) {
                gsap.fromTo(prize.value, { scale: 0.5, opacity: 0 }, { scale: 2, opacity: 1, duration: 1 });
            }
        });

        return { prize };
    }
};
</script>

<style scoped>
.zoom-animation {
    text-align: center;
    height: 400px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.prize-item {
    text-align: center;
}

.prize-item img {
    max-width: 200px;
}

.result-display {
    margin-top: 20px;
    font-size: 2em;
    color: #fff;
}

.bonus-text,
.mirage-text {
    font-size: 3em;
    color: gold;
    margin-top: 20px;
}
</style>