<template>
    <div class="slot-animation">
        <canvas ref="canvas"></canvas>
        <div class="result-display" v-if="showResult">{{ selectedPrize?.name }}</div>
        <div v-if="bonusMode === 'switch' && showBonus" class="bonus-text">ボーナス！</div>
        <div v-if="bonusMode === 'mirage' && showBonus" class="mirage-text">ミラージュ</div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, watch } from 'vue';
import gsap from 'gsap';
import type { PrizeDto } from '../../../model/applications/prize/dto/prize-dto';

export default {
    name: 'SlotAnimation',
    props: {
        selectedPrize: { type: Object as () => PrizeDto | null, default: null },
        bonusPrize: { type: Object as () => PrizeDto | null, default: null },
        bonusMode: { type: String, default: null },
        showResult: { type: Boolean, default: false },
        showBonus: { type: Boolean, default: false }
    },
    setup(props) {
        const canvas = ref<HTMLCanvasElement | null>(null);
        let ctx: CanvasRenderingContext2D | null = null;
        let reels: number[] = [0, 0, 0];

        onMounted(() => {
            if (!canvas.value) return;
            ctx = canvas.value.getContext('2d');
            canvas.value.width = 400;
            canvas.value.height = 200;
            draw();
        });

        const draw = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, 400, 200);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 400, 200);
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = '#fff';
                ctx.fillText(reels[i].toString(), 50 + i * 100, 100);
            }
        };

        watch(() => props.showResult, () => {
            if (props.showResult) {
                gsap.to(reels, {
                    [0]: 7, [1]: 7, [2]: 7,
                    duration: 2,
                    ease: 'power2.out',
                    onUpdate: draw
                });
            }
        });

        return { canvas };
    }
};
</script>

<style scoped>
.slot-animation {
    text-align: center;
}

canvas {
    border: 1px solid #ccc;
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