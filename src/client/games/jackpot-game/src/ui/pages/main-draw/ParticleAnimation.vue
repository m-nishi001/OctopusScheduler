<template>
    <div class="particle-animation">
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
    name: 'ParticleAnimation',
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
        let particles: { x: number; y: number; vx: number; vy: number; color: string }[] = [];

        onMounted(() => {
            if (!canvas.value) return;
            ctx = canvas.value.getContext('2d');
            canvas.value.width = 400;
            canvas.value.height = 400;
            initParticles();
            animate();
        });

        const initParticles = () => {
            for (let i = 0; i < 50; i++) {
                particles.push({
                    x: 200,
                    y: 200,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    color: `hsl(${Math.random() * 360}, 100%, 50%)`
                });
            }
        };

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, 400, 400);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                ctx!.beginPath();
                ctx!.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx!.fillStyle = p.color;
                ctx!.fill();
            });
            requestAnimationFrame(animate);
        };

        watch(() => props.showResult, () => {
            if (props.showResult) {
                gsap.to({}, { duration: 1, onComplete: () => { } }); // Trigger animation
            }
        });

        return { canvas };
    }
};
</script>

<style scoped>
.particle-animation {
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