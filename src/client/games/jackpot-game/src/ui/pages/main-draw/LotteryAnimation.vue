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

<script lang="ts">
import { ref, onMounted, watch } from 'vue';
import * as THREE from 'three';
import gsap from 'gsap';
import type { PrizeDto } from '../../../model/applications/prize/dto/prize-dto';

export default {
    name: 'LotteryAnimation',
    props: {
        animationType: {
            type: String,
            required: true,
            validator: (value: string) => [
                'roulette', 'slot', 'treasure', 'particle', 'zoom', 'bonus-switch', 'mirage'
            ].includes(value)
        },
        selectedPrize: {
            type: Object as () => PrizeDto | null,
            default: null
        },
        initialPrize: {
            type: Object as () => PrizeDto | null,
            default: null
        },
        finalPrize: {
            type: Object as () => PrizeDto | null,
            default: null
        },
        fakePrize: {
            type: Object as () => PrizeDto | null,
            default: null
        },
        realPrize: {
            type: Object as () => PrizeDto | null,
            default: null
        },
        showResult: {
            type: Boolean,
            default: false
        },
        showBonus: {
            type: Boolean,
            default: false
        }
    },
    setup(props) {
        const container = ref<HTMLElement | null>(null);
        const rouletteCanvas = ref<HTMLCanvasElement | null>(null);
        const slotCanvas = ref<HTMLCanvasElement | null>(null);
        const treasureCanvas = ref<HTMLCanvasElement | null>(null);
        const particleCanvas = ref<HTMLCanvasElement | null>(null);
        const zoomPrize = ref<HTMLElement | null>(null);
        const initialPrize = ref<HTMLElement | null>(null);
        const bonusText = ref<HTMLElement | null>(null);
        const finalPrize = ref<HTMLElement | null>(null);
        const fakePrize = ref<HTMLElement | null>(null);
        const realPrize = ref<HTMLElement | null>(null);

        let scene: THREE.Scene | null = null;
        let camera: THREE.Camera | null = null;
        let renderer: THREE.WebGLRenderer | null = null;

        onMounted(() => {
            if (props.animationType === 'roulette') initRoulette();
            else if (props.animationType === 'treasure') initTreasure();
            else if (props.animationType === 'particle') initParticle();
        });

        watch(() => props.showResult, (newVal) => {
            if (newVal) {
                if (props.animationType === 'zoom') animateZoom();
                else if (props.animationType === 'bonus-switch') animateBonusSwitch();
                else if (props.animationType === 'mirage') animateMirage();
            }
        });

        const initRoulette = () => {
            if (!rouletteCanvas.value) return;
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            renderer = new THREE.WebGLRenderer({ canvas: rouletteCanvas.value, alpha: true });
            renderer.setSize(400, 400);

            // Simple roulette geometry
            const geometry = new THREE.CylinderGeometry(1, 1, 0.1, 8);
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const roulette = new THREE.Mesh(geometry, material);
            scene.add(roulette);

            camera.position.z = 5;

            // Animation
            gsap.to(roulette.rotation, { y: Math.PI * 4, duration: 3, ease: 'power2.out' });
        };

        const initTreasure = () => {
            if (!treasureCanvas.value) return;
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            renderer = new THREE.WebGLRenderer({ canvas: treasureCanvas.value, alpha: true });
            renderer.setSize(400, 400);

            // Simple treasure chest
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
            const chest = new THREE.Mesh(geometry, material);
            scene.add(chest);

            camera.position.z = 5;

            // Open animation
            gsap.to(chest.rotation, { x: -Math.PI / 4, duration: 1, delay: 1 });
        };

        const initParticle = () => {
            if (!particleCanvas.value) return;
            // Simple particle effect with canvas
            const ctx = particleCanvas.value.getContext('2d');
            if (!ctx) return;
            particleCanvas.value.width = 400;
            particleCanvas.value.height = 400;

            // Draw particles
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

        return {
            container,
            rouletteCanvas,
            slotCanvas,
            treasureCanvas,
            particleCanvas,
            zoomPrize,
            initialPrize,
            bonusText,
            finalPrize,
            fakePrize,
            realPrize
        };
    }
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
<parameter name="filePath">/root/google_apps_script/octopus-scheduler/src/client/games/jackpot-game/src/ui/pages/main-draw/LotteryAnimation.vue