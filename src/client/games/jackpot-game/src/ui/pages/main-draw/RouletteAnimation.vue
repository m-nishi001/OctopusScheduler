<template>
    <div class="roulette-animation">
        <canvas ref="canvas"></canvas>
        <div class="result-display" v-if="showResult">{{ selectedPrize?.name }}</div>
        <div v-if="bonusMode === 'switch' && showBonus" class="bonus-text">ボーナス！</div>
        <div v-if="bonusMode === 'mirage' && showBonus" class="mirage-text">ミラージュ</div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, watch } from 'vue';
import * as THREE from 'three';
import gsap from 'gsap';
import type { PrizeDto } from '../../../model/applications/prize/dto/prize-dto';

export default {
    name: 'RouletteAnimation',
    props: {
        selectedPrize: { type: Object as () => PrizeDto | null, default: null },
        bonusPrize: { type: Object as () => PrizeDto | null, default: null },
        bonusMode: { type: String, default: null }, // 'switch' or 'mirage'
        showResult: { type: Boolean, default: false },
        showBonus: { type: Boolean, default: false }
    },
    setup(props) {
        const canvas = ref<HTMLCanvasElement | null>(null);
        let scene: THREE.Scene;
        let camera: THREE.PerspectiveCamera;
        let renderer: THREE.WebGLRenderer;
        let roulette: THREE.Mesh;

        onMounted(() => {
            if (!canvas.value) return;
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, 400 / 400, 0.1, 1000);
            renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true });
            renderer.setSize(400, 400);

            const geometry = new THREE.CylinderGeometry(1, 1, 0.1, 8);
            const material = new THREE.MeshBasicMaterial({ color: 0xffd700 });
            roulette = new THREE.Mesh(geometry, material);
            scene.add(roulette);

            camera.position.z = 5;

            animate();
        });

        const animate = () => {
            requestAnimationFrame(animate);
            if (renderer) renderer.render(scene, camera);
        };

        watch(() => props.showResult, () => {
            if (props.showResult) {
                gsap.to(roulette.rotation, { y: Math.PI * 4, duration: 3, ease: 'power2.out' });
            }
        });

        return { canvas };
    }
};
</script>

<style scoped>
.roulette-animation {
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