<template>
    <div ref="container" class="three-hero" aria-hidden="true">
        <div class="vignette" aria-hidden="true"></div>
    </div>
</template>

<script lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import * as THREE from 'three';

export default {
    name: 'ThreeHero',
    props: {
        loaded: { type: Boolean, default: false }
    },
    setup(props: any) {
        const container = ref<HTMLElement | null>(null);
        let renderer: THREE.WebGLRenderer | null = null;
        let scene: THREE.Scene | null = null;
        let camera: THREE.PerspectiveCamera | null = null;
        let frameId: number | null = null;

        const init = () => {
            if (!container.value) return;
            const width = window.innerWidth;
            const height = window.innerHeight;

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(window.devicePixelRatio || 1);
            // setSize without updating inline px styles, we'll use vw/vh CSS to avoid fixed px values
            renderer.setSize(width, height, false);
            (renderer as any).outputEncoding = (THREE as any).sRGBEncoding;
            (renderer as any).toneMapping = (THREE as any).ACESFilmicToneMapping;
            container.value.appendChild(renderer.domElement);
            // ensure canvas is full viewport using vw/vh (prevents px fixed values)
            renderer.domElement.style.width = '100vw';
            renderer.domElement.style.height = '100vh';

            scene = new THREE.Scene();

            camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
            camera.position.set(0, 1.2, 4.2);

            // ambient & key lights
            const ambient = new THREE.AmbientLight(0xffffff, 0.35);
            scene.add(ambient);
            const key = new THREE.DirectionalLight(0xfff7e8, 0.9);
            key.position.set(6, 10, 12);
            scene.add(key);
            const fill = new THREE.DirectionalLight(0x9ec7ff, 0.4);
            fill.position.set(-6, -4, -8);
            scene.add(fill);

            // ground plane for subtle reflection
            const groundMat = new THREE.MeshStandardMaterial({ color: 0x071026, roughness: 0.6, metalness: 0 });
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat);
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = -1.6;
            scene.add(ground);

            // CENTRAL OBJECT REMOVED: instead create animated rings and accents for jackpot vibe
            const ringGroup = new THREE.Group();
            const ringCount = 3;
            const rings: THREE.Mesh[] = [];
            for (let i = 0; i < ringCount; i++) {
                const radius = 2.4 + i * 0.8;
                const ringGeo = new THREE.RingGeometry(radius - 0.06, radius + 0.06, 64);
                const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.06 + i * 0.08, 0.9, 0.55), transparent: true, opacity: 0.12 });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = -Math.PI / 2;
                ring.position.y = -0.2 + i * -0.05;
                ringGroup.add(ring);
                rings.push(ring);
            }
            scene.add(ringGroup);

            // particle field
            const particlesCount = 420;
            const particlesGeom = new THREE.BufferGeometry();
            const positions = new Float32Array(particlesCount * 3);
            for (let i = 0; i < particlesCount; i++) {
                positions[i * 3 + 0] = (Math.random() - 0.5) * 12;
                positions[i * 3 + 1] = (Math.random() - 0.2) * 6;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
            }
            particlesGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const particlesMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.6 });
            const particles = new THREE.Points(particlesGeom, particlesMat);
            scene.add(particles);

            // subtle background color
            scene.background = new THREE.Color(0x071428);

            const animate = (t: number) => {
                const time = t * 0.001;
                // slow ambient ring rotation
                ringGroup.rotation.z = Math.sin(time * 0.18) * 0.12;
                // particle gentle motion
                particles.rotation.y = Math.sin(time * 0.08) * 0.06;
                // pulse rings and particles when loaded
                const loadFactor = props.loaded ? 1 : 0.35;
                for (let i = 0; i < rings.length; i++) {
                    const r = rings[i];
                    ((r.material as any) as THREE.MeshBasicMaterial).opacity = 0.06 + 0.12 * loadFactor * Math.abs(Math.sin(time * (0.6 + i * 0.12)));
                    r.scale.setScalar(1 + 0.03 * loadFactor * Math.sin(time * (0.8 + i * 0.2)));
                }
                // particle amplitude mod
                (particles.material as THREE.PointsMaterial).opacity = 0.35 + 0.4 * loadFactor * (0.5 + 0.5 * Math.sin(time * 0.9));

                if (renderer && scene && camera) renderer.render(scene, camera);
                frameId = requestAnimationFrame(animate);
            };
            frameId = requestAnimationFrame(animate);

            const onResize = () => {
                if (!camera || !renderer) return;
                const w = window.innerWidth;
                const h = window.innerHeight;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                // update buffer size but keep CSS vw/vh
                renderer.setSize(w, h, false);
                renderer.domElement.style.width = '100vw';
                renderer.domElement.style.height = '100vh';
            };
            window.addEventListener('resize', onResize);
            (init as any)._onResize = onResize;
        };

        onMounted(() => init());
        onUnmounted(() => {
            if (frameId) cancelAnimationFrame(frameId);
            if (container.value) {
                while (container.value.firstChild) container.value.removeChild(container.value.firstChild);
            }
            window.removeEventListener('resize', (init as any)._onResize);
            renderer = null;
            scene = null;
            camera = null;
        });

        return { container };
    }
};
</script>

<style scoped>
.three-hero {
    position: absolute;
    inset: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}

.three-hero canvas {
    display: block;
    width: 100vw !important;
    height: 100vh !important;
}

.vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at center, rgba(10, 20, 34, 0.0) 40%, rgba(4, 8, 16, 0.55) 100%);
    mix-blend-mode: multiply;
}
</style>
