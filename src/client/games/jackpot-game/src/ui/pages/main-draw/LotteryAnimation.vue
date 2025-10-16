<template>
    <div class="lottery-animation" ref="container">
        <div v-if="animationType === 'roulette'" class="roulette-container">
            <canvas ref="rouletteCanvas"></canvas>
            <div class="result-display" v-if="showResult">{{ selectedPrize?.name }}</div>
        </div>

        <div v-else-if="animationType === 'slot'" class="slot-container">
            <canvas ref="slotCanvas"></canvas>
            <div class="result-display" v-if="showResult">{{ selectedPrize?.name }}</div>
        </div>

        <div v-else-if="animationType === 'treasure'" class="treasure-container">
            <canvas ref="treasureCanvas"></canvas>
            <div class="result-display" v-if="showResult">{{ selectedPrize?.name }}</div>
        </div>

        <div v-else-if="animationType === 'particle'" class="particle-container">
            <canvas ref="particleCanvas"></canvas>
            <div class="result-display" v-if="showResult">{{ selectedPrize?.name }}</div>
        </div>

        <div v-else-if="animationType === 'zoom'" class="zoom-container">
            <div class="prize-item" ref="zoomPrize" v-if="selectedPrize">
                <img :src="selectedPrize.imageAssetId" :alt="selectedPrize.name" />
                <p>{{ selectedPrize.name }}</p>
            </div>
        </div>

        <div v-else-if="animationType === 'bonus-switch'" class="bonus-container">
            <div class="initial-prize" ref="initialPrize" v-if="initialPrize">{{ initialPrize.name }}</div>
            <div class="bonus-text" ref="bonusText" v-if="showBonus">ボーナス！</div>
            <div class="final-prize" ref="finalPrize" v-if="finalPrize">{{ finalPrize.name }}</div>
        </div>

        <div v-else-if="animationType === 'mirage'" class="mirage-container">
            <div class="fake-prize" ref="fakePrize" v-if="fakePrize">{{ fakePrize.name }}</div>
            <div class="real-prize" ref="realPrize" v-if="realPrize">{{ realPrize.name }}</div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
import gsap from 'gsap';
import type { PrizeDto } from '../../../model/applications/prize/dto/prize-dto';

interface Props {
    animationType: 'roulette' | 'slot' | 'treasure' | 'particle' | 'zoom' | 'bonus-switch' | 'mirage';
    prizes?: PrizeDto[];
    selectedPrize?: PrizeDto | null;
    initialPrize?: PrizeDto | null;
    finalPrize?: PrizeDto | null;
    fakePrize?: PrizeDto | null;
    realPrize?: PrizeDto | null;
    showResult?: boolean;
    showBonus?: boolean;
}

const props = defineProps<Props>();

const animationType = computed(() => props.animationType);
const prizes = computed(() => props.prizes || []);
const selectedPrize = computed(() => props.selectedPrize || null);
const showResult = computed(() => !!props.showResult);
const showBonus = computed(() => !!props.showBonus);
const initialPrize = computed(() => props.initialPrize || null);
const finalPrize = computed(() => props.finalPrize || null);
const fakePrize = computed(() => props.fakePrize || null);
const realPrize = computed(() => props.realPrize || null);

const container = ref<HTMLElement | null>(null);
const rouletteCanvas = ref<HTMLCanvasElement | null>(null);
const slotCanvas = ref<HTMLCanvasElement | null>(null);
const treasureCanvas = ref<HTMLCanvasElement | null>(null);
const particleCanvas = ref<HTMLCanvasElement | null>(null);
const zoomPrize = ref<HTMLElement | null>(null);
const bonusText = ref<HTMLElement | null>(null);

let rafId: number | null = null;
let currentAngle = { value: 0 } as { value: number };
let spinning = false;

onMounted(() => {
    if (animationType.value === 'roulette') initRoulette();
    else if (animationType.value === 'treasure') initTreasure();
    else if (animationType.value === 'particle') initParticle();
});

watch(showResult, (newVal) => {
    if (newVal) {
        if (animationType.value === 'zoom') animateZoom();
        else if (animationType.value === 'bonus-switch') animateBonusSwitch();
        else if (animationType.value === 'mirage') animateMirage();
    }
});

watch(selectedPrize, (newVal) => {
    if (animationType.value === 'roulette' && newVal) {
        spinToSelected();
    }
});

onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId);
});

const initRoulette = () => {
    if (!rouletteCanvas.value) return;
    const canvas = rouletteCanvas.value;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const size = 400;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const drawWheel = (angle = currentAngle.value) => {
        const w = size;
        const h = size;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) * 0.4;
        ctx.clearRect(0, 0, w, h);

        const sectors = (prizes.value && prizes.value.length) ? prizes.value.length : 8;
        const sectorAngle = (Math.PI * 2) / sectors;

        for (let i = 0; i < sectors; i++) {
            const start = angle + i * sectorAngle;
            const end = start + sectorAngle;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, start, end);
            ctx.closePath();
            const hue = (i * 360 / sectors + 30) % 360;
            ctx.fillStyle = `hsl(${hue}, 80%, 45%)`;
            ctx.fill();
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.stroke();

            // label
            ctx.save();
            const mid = start + sectorAngle / 2;
            ctx.translate(cx + Math.cos(mid) * radius * 0.65, cy + Math.sin(mid) * radius * 0.65);
            ctx.rotate(mid + Math.PI / 2);
            ctx.fillStyle = '#fff';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = (prizes.value && prizes.value[i]) ? prizes.value[i].name : `#${i + 1}`;
            wrapText(ctx, label, 0, 0, 80, 14);
            ctx.restore();
        }

        // center circle
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();

        // pointer
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius - 6);
        ctx.lineTo(cx - 12, cy - radius + 18);
        ctx.lineTo(cx + 12, cy - radius + 18);
        ctx.closePath();
        ctx.fillStyle = '#ffd400';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    };

    const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
        const words = text.split(' ');
        let line = '';
        let test = '';
        let ty = y;
        for (let n = 0; n < words.length; n++) {
            test = line + words[n] + ' ';
            const metrics = ctx.measureText(test);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, x, ty);
                line = words[n] + ' ';
                ty += lineHeight;
            } else {
                line = test;
            }
        }
        ctx.fillText(line, x, ty);
    };

    const render = () => {
        drawWheel();
        rafId = requestAnimationFrame(render);
    };
    render();
};

const spinToSelected = async () => {
    if (!rouletteCanvas.value || spinning) return;
    const sectors = (prizes.value && prizes.value.length) ? prizes.value.length : 8;
    const sectorAngle = (Math.PI * 2) / sectors;
    const selectedIndex = prizes.value && selectedPrize.value ? prizes.value.findIndex(p => p.id === selectedPrize.value?.id) : -1;
    const targetIndex = selectedIndex >= 0 ? selectedIndex : Math.floor(Math.random() * sectors);
    const randomRounds = 3 + Math.floor(Math.random() * 3);
    const targetMidAngle = (targetIndex + 0.5) * sectorAngle;
    const finalAngle = -Math.PI / 2 - targetMidAngle + randomRounds * Math.PI * 2 + (Math.random() - 0.5) * (sectorAngle * 0.6);

    spinning = true;
    await gsap.to(currentAngle, { value: finalAngle, duration: 4, ease: 'power3.out' });
    spinning = false;
};

const initTreasure = () => {
    if (!treasureCanvas.value) return;
    const canvas = treasureCanvas.value;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 400;
    canvas.height = 400;
    ctx.fillStyle = '#6b3';
    ctx.fillRect(120, 160, 160, 120);
    ctx.fillStyle = '#000';
    ctx.fillText('Chest', 200, 220);
};

const initParticle = () => {
    if (!particleCanvas.value) return;
    const ctx = particleCanvas.value.getContext('2d');
    if (!ctx) return;
    particleCanvas.value.width = 400;
    particleCanvas.value.height = 400;

    for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 400, Math.random() * 400, 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 50%)`;
        ctx.fill();
    }
};

const animateZoom = () => {
    if (!zoomPrize.value) return;
    gsap.fromTo(zoomPrize.value, { scale: 0.5, opacity: 0 }, { scale: 2, opacity: 1, duration: 1 });
};

const animateBonusSwitch = () => {
    if (!initialPrize.value || !bonusText.value || !finalPrize.value) return;
    gsap.timeline()
        .to(initialPrize.value, { opacity: 1, duration: 0.5 })
        .to(initialPrize.value, { opacity: 0, duration: 0.5, delay: 1 })
        .to(bonusText.value, { opacity: 1, scale: 1.5, duration: 0.5 })
        .to(bonusText.value, { opacity: 0, duration: 0.5, delay: 1 })
        .to(finalPrize.value, { opacity: 1, duration: 0.5 });
};

const animateMirage = () => {
    if (!fakePrize.value || !realPrize.value) return;
    gsap.timeline()
        .to(fakePrize.value, { opacity: 1, duration: 0.5 })
        .to(fakePrize.value, { opacity: 0, scale: 0.5, duration: 0.5, delay: 1 })
        .to(realPrize.value, { opacity: 1, scale: 1.2, duration: 0.5 });
};
</script>

<style scoped>
.lottery-animation {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 400px;
}

canvas {
    border: 1px solid #ccc;
}

.result-display {
    margin-top: 20px;
    font-size: 2em;
    color: #fff;
    text-align: center;
}

.prize-item {
    text-align: center;
}

.prize-item img {
    max-width: 200px;
}

.bonus-container,
.mirage-container {
    text-align: center;
}

.initial-prize,
.final-prize,
.fake-prize,
.real-prize {
    font-size: 2em;
    margin: 20px;
    opacity: 0;
}

.bonus-text {
    font-size: 3em;
    color: gold;
    opacity: 0;
}
</style>