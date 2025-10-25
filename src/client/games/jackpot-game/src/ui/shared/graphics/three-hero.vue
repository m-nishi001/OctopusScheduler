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
    props: { loaded: { type: Boolean, default: false } },
    setup() {
        const container = ref<HTMLElement | null>(null);
        let renderer: THREE.WebGLRenderer | null = null;
        let scene: THREE.Scene | null = null;
        let camera: THREE.PerspectiveCamera | null = null;
        let frameId: number | null = null;

        const createNumberTexture = (n: number) => {
            const size = 128;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d')!;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
            ctx.fill();

            ctx.lineWidth = 10;
            ctx.strokeStyle = '#ff7a7a';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#222';
            ctx.font = 'bold 64px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(n), size / 2, size / 2 + 4);
            return new THREE.CanvasTexture(canvas);
        };

        const init = () => {
            if (!container.value) return;
            const width = window.innerWidth;
            const height = window.innerHeight;

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(window.devicePixelRatio || 1);
            renderer.setSize(width, height, false);
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            container.value.appendChild(renderer.domElement);
            renderer.domElement.style.width = '100vw';
            renderer.domElement.style.height = '100vh';

            scene = new THREE.Scene();

            camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
            camera.position.set(0, 2.2, 6);

            const ambient = new THREE.AmbientLight(0xffffff, 0.25);
            scene.add(ambient);
            const spot = new THREE.SpotLight(0xfff6e6, 1.6, 15, Math.PI / 6, 0.4, 1);
            spot.position.set(0, 6, 2);
            spot.castShadow = false;
            scene.add(spot);

            const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b1212, roughness: 0.6, metalness: 0.2 });
            const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -1.2;
            scene.add(floor);

            const drumGroup = new THREE.Group();
            const drumRadius = 1.6;
            const drumHeight = 1.2;
            const outerMat = new THREE.MeshStandardMaterial({ color: 0xffd36f, metalness: 0.6, roughness: 0.25 });
            const innerMat = new THREE.MeshStandardMaterial({ color: 0x4b2b2b, metalness: 0.2, roughness: 0.6 });

            const outer = new THREE.Mesh(new THREE.CylinderGeometry(drumRadius + 0.12, drumRadius + 0.12, drumHeight, 64, 1, true), outerMat);
            outer.position.y = -0.6;
            drumGroup.add(outer);

            const rim = new THREE.Mesh(new THREE.TorusGeometry(drumRadius + 0.12, 0.06, 8, 64), new THREE.MeshStandardMaterial({ color: 0xffa84d, metalness: 0.7, roughness: 0.2 }));
            rim.rotation.x = Math.PI / 2;
            rim.position.y = -0.05;
            drumGroup.add(rim);

            const inner = new THREE.Mesh(new THREE.CylinderGeometry(drumRadius - 0.02, drumRadius - 0.02, drumHeight - 0.18, 64), innerMat);
            inner.position.y = -0.6;
            drumGroup.add(inner);

            drumGroup.position.y = -0.2;
            scene.add(drumGroup);

            const balls: THREE.Mesh[] = [];
            const ballCount = 8;
            for (let i = 0; i < ballCount; i++) {
                const tex = createNumberTexture(i + 1);
                const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.2, roughness: 0.4 });
                const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 32), mat);
                const angle = (Math.PI * 2 * i) / ballCount + Math.random() * 0.4;
                const r = drumRadius * 0.6 * (0.6 + Math.random() * 0.4);
                s.position.set(Math.cos(angle) * r, -0.6 + Math.random() * 0.18, Math.sin(angle) * r);
                s.userData = { phase: Math.random() * Math.PI * 2, offset: Math.random() * 0.5 };
                drumGroup.add(s);
                balls.push(s);
            }

            const confCount = 160;
            const confPos = new Float32Array(confCount * 3);
            const confCol = new Float32Array(confCount * 3);
            for (let i = 0; i < confCount; i++) {
                confPos[i * 3 + 0] = (Math.random() - 0.5) * 6;
                confPos[i * 3 + 1] = Math.random() * 3 - 0.5;
                confPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
                const c = [0xffd36f, 0xff7a7a, 0xffffff, 0xffc08a][Math.floor(Math.random() * 4)];
                confCol[i * 3 + 0] = ((c >> 16) & 255) / 255;
                confCol[i * 3 + 1] = ((c >> 8) & 255) / 255;
                confCol[i * 3 + 2] = (c & 255) / 255;
            }
            const confGeom = new THREE.BufferGeometry();
            confGeom.setAttribute('position', new THREE.BufferAttribute(confPos, 3));
            confGeom.setAttribute('color', new THREE.BufferAttribute(confCol, 3));
            const confMat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, depthWrite: false });
            const confetti = new THREE.Points(confGeom, confMat);
            scene.add(confetti);

            scene.background = new THREE.Color(0x0b0a0a);

            const animate = (t: number) => {
                const time = t * 0.001;

                drumGroup.rotation.y = Math.sin(time * 0.2) * 0.18 + time * 0.04;

                for (let i = 0; i < balls.length; i++) {
                    const b = balls[i];
                    const ud = b.userData as any;
                    b.position.y = -0.6 + 0.08 * Math.abs(Math.sin(time * 2 + ud.phase));
                    b.rotation.y = time * 1.2 + ud.offset;
                }

                const positions = confGeom.attributes.position.array as Float32Array;
                for (let i = 0; i < confCount; i++) {
                    const idx = i * 3 + 1;
                    positions[idx] -= 0.006 + 0.004 * Math.sin(time * 1.5 + i);
                    if (positions[idx] < -1.5) positions[idx] = 3 + Math.random() * 1.2;
                }
                confGeom.attributes.position.needsUpdate = true;

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
    background: radial-gradient(circle at 50% 36%, rgba(255, 244, 220, 0.95) 0%, rgba(255, 180, 80, 0.06) 12%, rgba(10, 6, 6, 0.8) 60%);
    mix-blend-mode: multiply;
}
</style>
