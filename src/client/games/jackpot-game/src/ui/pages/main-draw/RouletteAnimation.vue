<template>
    <div class="roulette-animation">
        <canvas ref="canvas" @click="toggleSpin"></canvas>
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
        prizes: { type: Array as () => PrizeDto[], default: () => [] },
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
        let roulette: THREE.Group;
        let spinning = false;

        onMounted(() => {
            if (!canvas.value) return;
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, 400 / 400, 0.1, 1000);
            renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true });
            // make the roulette visually larger: increase canvas and camera distance
            const size = 800; // ~2x larger than before
            renderer.setSize(size, size);

            camera.position.z = 8;

            createRoulette();
            animate();
        });

        const createRoulette = () => {
            roulette = new THREE.Group();
            const sectors = Math.max(8, props.prizes.length);
            const sectorAngle = (Math.PI * 2) / sectors;
            const radius = 3.0; // larger radius
            const depth = 0.1;

            // create wedge shapes (fan) in the XY plane so they face the camera
            for (let i = 0; i < sectors; i++) {
                const startAngle = i * sectorAngle;
                const endAngle = startAngle + sectorAngle;

                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                // draw outer arc
                const segments = 12;
                for (let s = 0; s <= segments; s++) {
                    const t = s / segments;
                    const a = startAngle + (endAngle - startAngle) * t;
                    const x = Math.cos(a) * radius;
                    const y = Math.sin(a) * radius;
                    if (s === 0) shape.lineTo(x, y);
                    else shape.lineTo(x, y);
                }
                shape.lineTo(0, 0);

                const geometry = new THREE.ShapeGeometry(shape);
                // give a small thickness by extruding a tiny amount
                geometry.translate(0, 0, 0);

                const material = new THREE.MeshLambertMaterial({ map: createTexture(i), side: THREE.DoubleSide });
                const mesh = new THREE.Mesh(geometry, material);
                // rotate so that 0 angle points to the right and positive rotation moves CCW
                mesh.rotation.z = 0;
                // keep lying in XY plane (facing camera); position small offset in z to create slight depth
                mesh.position.z = -depth * 0.5;
                roulette.add(mesh);
            }

            // Add lighting
            const light = new THREE.DirectionalLight(0xffffff, 1);
            light.position.set(5, 5, 10);
            scene.add(light);
            const ambientLight = new THREE.AmbientLight(0x404040);
            scene.add(ambientLight);

            scene.add(roulette);
        };

        const createTexture = (index: number) => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d')!;
            const hue = (index * 360) / Math.max(8, props.prizes.length);
            ctx.fillStyle = `hsl(${hue + 30}, 80%, 45%)`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = '26px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const prize = props.prizes[index];
            const label = prize ? prize.name : `#${index + 1}`;
            // draw label near the outer edge
            ctx.fillText(label, canvas.width / 2, canvas.height * 0.75);

            const texture = new THREE.CanvasTexture(canvas);

            if (prize && (prize.imageDataUrl || prize.imageAssetId)) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    // draw image centered in the top half
                    const iw = canvas.width * 0.5;
                    const ih = canvas.height * 0.4;
                    ctx.drawImage(img, (canvas.width - iw) / 2, canvas.height * 0.08, iw, ih);
                    texture.needsUpdate = true;
                };
                img.src = prize.imageDataUrl || prize.imageAssetId || '';
            }

            return texture;
        };

        const animate = () => {
            requestAnimationFrame(animate);
            if (renderer) renderer.render(scene, camera);
        };

        const toggleSpin = () => {
            if (spinning) stopSpin(); else startSpin();
        };

        const startSpin = () => {
            spinning = true;
            gsap.to(roulette.rotation, {
                z: roulette.rotation.z + Math.PI * 6,
                duration: 3,
                ease: 'power2.out',
                onComplete: () => {
                    spinning = false;
                }
            });
        };

        const stopSpin = () => {
            gsap.killTweensOf(roulette.rotation);
            spinning = false;
        };

        watch(() => props.showResult, () => {
            if (props.showResult && props.selectedPrize) {
                const sectors = Math.max(8, props.prizes.length);
                const sectorAngle = (Math.PI * 2) / sectors;
                const selectedIndex = props.prizes.findIndex(p => p.id === props.selectedPrize?.id);
                const targetIndex = selectedIndex >= 0 ? selectedIndex : Math.floor(Math.random() * sectors);
                // compute angle so the selected sector moves to the top (pi/2)
                const targetAngle = - (targetIndex * sectorAngle + sectorAngle / 2) + Math.PI / 2;
                gsap.to(roulette.rotation, {
                    z: targetAngle,
                    duration: 4,
                    ease: 'power3.out'
                });
            }
        });

        return { canvas, toggleSpin };
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