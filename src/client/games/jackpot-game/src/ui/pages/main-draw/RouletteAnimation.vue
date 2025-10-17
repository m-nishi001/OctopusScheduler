<template>
    <div class="roulette-animation">
        <div class="roulette-canvas-wrapper">
            <canvas ref="canvas" @click="toggleSpin"></canvas>
            <!-- 当たりインジケーター（真上・上向き） -->
            <svg class="indicator top" width="90" height="90" viewBox="0 0 90 90">
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="4.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <radialGradient id="goldGrad" cx="50%" cy="40%" r="60%">
                        <stop offset="0%" stop-color="#fffbe6" />
                        <stop offset="60%" stop-color="#ffe066" />
                        <stop offset="100%" stop-color="#bfae6a" />
                    </radialGradient>
                </defs>
                <!-- ゴールド三角形（上向き） -->
                <polygon points="45,10 80,70 10,70" fill="url(#goldGrad)" stroke="#fff" stroke-width="5"
                    filter="url(#glow)" />
                <!-- 縁取り -->
                <polygon points="45,18 72,66 18,66" fill="none" stroke="#ffb700" stroke-width="3.5" />
                <!-- 宝石風円 -->
                <circle cx="45" cy="28" r="7" fill="#fffbe6" stroke="#ffb700" stroke-width="2.5" filter="url(#glow)" />
                <circle cx="45" cy="28" r="4.2" fill="#ffe066" stroke="#fff" stroke-width="1.2" />
                <!-- 星型装飾 -->
                <polygon points="45,19 47,25 53,25 48,28 50,34 45,30 40,34 42,28 37,25 43,25" fill="#fffbe6"
                    stroke="#ffb700" stroke-width="1" filter="url(#glow)" />
                <!-- JACKPOTテキスト -->
                <text x="45" y="52" text-anchor="middle" font-size="22" font-weight="bold" fill="#fffbe6"
                    stroke="#ffb700" stroke-width="2.8" filter="url(#glow)"
                    style="font-family:'Segoe UI',Arial,sans-serif;">JACKPOT</text>
            </svg>
        </div>
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
        let ringHighlight: THREE.Mesh | null = null;
        // 背景パーティクル
        let bgParticles: THREE.Points | null = null;
        let spinning = false;
        // Enterキーで開始・停止
        onMounted(() => {
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') toggleSpin();
            });
        });

        onMounted(() => {
            if (!canvas.value) return;
            scene = new THREE.Scene();
            // 3D感を強調するため斜め視点
            camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
            renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true });
            const size = 420;
            renderer.setSize(size, size);
            camera.position.set(0, 1.2, 7.2); // 下から見上げる
            camera.lookAt(0, 0.5, 0); // 少し上を向く
            createRoulette();
            // --- 背景パーティクル生成（強調・アニメーション） ---
            const N = 180;
            const bgGeo = new THREE.BufferGeometry();
            const pos = new Float32Array(N * 3);
            const col = new Float32Array(N * 3);
            const baseColors = [
                [1, 0.98, 0.7], // ゴールド
                [1, 0.85, 0.85], // 赤
                [0.8, 1, 0.8],   // 緑
                [0.8, 0.9, 1],   // 青
                [0.95, 0.85, 1], // 紫
                [1, 1, 1]        // 白
            ];
            for (let i = 0; i < N; i++) {
                const r = 3.2 + Math.random() * 2.5;
                const a = Math.random() * Math.PI * 2;
                pos[i * 3] = Math.cos(a) * r;
                pos[i * 3 + 1] = Math.sin(a) * r;
                pos[i * 3 + 2] = -0.2 + Math.random() * 0.1;
                const c = baseColors[i % baseColors.length];
                col[i * 3] = c[0];
                col[i * 3 + 1] = c[1];
                col[i * 3 + 2] = c[2];
            }
            bgGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            bgGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
            const bgMat = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 0.28 });
            bgParticles = new THREE.Points(bgGeo, bgMat);
            scene.add(bgParticles);
            animate();
        });

        const createRoulette = () => {
            // --- 影・床反射の追加 ---
            // 床（グラデーションテクスチャ）
            const floorSize = 8;
            const floorCanvas = document.createElement('canvas');
            floorCanvas.width = 256;
            floorCanvas.height = 256;
            const fctx = floorCanvas.getContext('2d')!;
            const grad = fctx.createRadialGradient(128, 128, 10, 128, 128, 128);
            grad.addColorStop(0, 'rgba(255,255,240,0.28)');
            grad.addColorStop(0.4, 'rgba(255,255,220,0.13)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            fctx.fillStyle = grad;
            fctx.fillRect(0, 0, 256, 256);
            const floorTex = new THREE.CanvasTexture(floorCanvas);
            const floorMat = new THREE.MeshBasicMaterial({ map: floorTex, transparent: true });
            const floorGeo = new THREE.CircleGeometry(floorSize, 64);
            const floorMesh = new THREE.Mesh(floorGeo, floorMat);
            floorMesh.position.set(0, 0, -0.45);
            floorMesh.rotation.x = -Math.PI / 2;
            scene.add(floorMesh);

            // 影（半透明黒円）
            const shadowGeo = new THREE.CircleGeometry(2.7, 48);
            const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.09 });
            const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
            shadowMesh.position.set(0, 0, -0.44);
            shadowMesh.rotation.x = -Math.PI / 2;
            scene.add(shadowMesh);
            roulette = new THREE.Group();
            const sectors = Math.max(6, props.prizes.length);
            const sectorAngle = (Math.PI * 2) / sectors;
            // 円の中心・半径・太さを厳密に設計
            // ルーレット本体円: radius = baseRadius
            // 外側リング: radius = baseRadius + ringOffset, tube = ringTube
            // 外側グロー: radius = baseRadius + glowOffset, tube = glowTube
            const baseRadius = 3.0;
            const ringOffset = 0.18;
            const ringTube = 0.10;
            const glowOffset = 0.28;
            const glowTube = 0.13;
            const radius = baseRadius;
            const depth = 0.18;
            // 豪華な外周リング（金属感・光沢・均等なグロー）
            const ringGeom = new THREE.TorusGeometry(baseRadius + ringOffset, ringTube, 64, 160);
            const ringMat = new THREE.MeshPhysicalMaterial({
                color: 0xfffbe6,
                metalness: 1,
                roughness: 0.04,
                clearcoat: 1,
                clearcoatRoughness: 0.02,
                reflectivity: 1,
                ior: 2.4,
                transmission: 0.18,
                emissive: 0xfff200,
                emissiveIntensity: 0.18,
                sheen: 1,
                sheenColor: 0xffffff,
                sheenRoughness: 0.08
            });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.position.z = 0.12;
            // 均等なグロー: 輪郭に半透明の光彩を追加（tube/offset厳密設計）
            const glowGeom = new THREE.TorusGeometry(baseRadius + glowOffset, glowTube, 64, 160);
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0xfff6b0,
                transparent: true,
                opacity: 0.13,
                depthWrite: false
            });
            const glow = new THREE.Mesh(glowGeom, glowMat);
            glow.position.z = 0.13;
            roulette.add(glow);
            roulette.add(ring);

            // 内側リムライト（白い細いトーラス）
            const rimGeom = new THREE.TorusGeometry(radius + 0.09, 0.03, 16, 64);
            const rimMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
            const rim = new THREE.Mesh(rimGeom, rimMat);
            rim.position.z = 0.14;
            roulette.add(rim);

            // --- 回転時の光反射アニメーション（リング上の動的ハイライト） ---
            const highlightGeom = new THREE.TorusGeometry(radius + 0.18, 0.14, 16, 64, Math.PI / 5);
            const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38 });
            ringHighlight = new THREE.Mesh(highlightGeom, highlightMat);
            ringHighlight.position.z = 0.15;
            roulette.add(ringHighlight);

            // セクター本体
            for (let i = 0; i < sectors; i++) {
                const startAngle = i * sectorAngle;
                const endAngle = startAngle + sectorAngle;
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                const segments = 24;
                for (let s = 0; s <= segments; s++) {
                    const t = s / segments;
                    const a = startAngle + (endAngle - startAngle) * t;
                    const x = Math.cos(a) * radius;
                    const y = Math.sin(a) * radius;
                    shape.lineTo(x, y);
                }
                shape.lineTo(0, 0);
                const geometry = new THREE.ShapeGeometry(shape);
                geometry.translate(0, 0, 0);
                // ゴールドグラデーション＋光沢
                const material = new THREE.MeshPhysicalMaterial({
                    map: createTexture(i),
                    color: 0xffffff,
                    metalness: 0.7,
                    roughness: 0.25,
                    clearcoat: 0.7,
                    clearcoatRoughness: 0.15,
                    side: THREE.DoubleSide,
                    emissive: 0x222200,
                    emissiveIntensity: 0.08
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.z = -depth * 0.5;
                mesh.rotation.z = 0;
                roulette.add(mesh);

                // --- セクター境界線（太く・発光感） ---
                const lineMat = new THREE.LineBasicMaterial({ color: 0xfff200, linewidth: 4 });
                const points = [];
                points.push(new THREE.Vector3(0, 0, -depth * 0.48));
                points.push(new THREE.Vector3(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius, -depth * 0.48));
                const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(lineGeom, lineMat);
                roulette.add(line);
                // 境界線グロー（半透明の太い白ライン）
                const glowMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10, transparent: true, opacity: 0.18 });
                const glowLine = new THREE.Line(lineGeom, glowMat);
                roulette.add(glowLine);
            }

            // ルーレット中央のJACKPOTロゴ（大きく・エンボス・光沢）
            const loader = new THREE.TextureLoader();
            loader.load(
                'https://img.icons8.com/external-flaticons-flat-flat-icons/512/external-jackpot-casino-flaticons-flat-flat-icons-2.png',
                (texture) => {
                    // 明るく高彩度なエンボス風マテリアル
                    const mat = new THREE.MeshPhysicalMaterial({
                        map: texture,
                        transparent: true,
                        metalness: 0.9,
                        roughness: 0.12,
                        clearcoat: 1,
                        clearcoatRoughness: 0.03,
                        reflectivity: 1,
                        sheen: 1,
                        sheenColor: 0xfffbe6,
                        sheenRoughness: 0.08,
                        emissive: 0xfff200,
                        emissiveIntensity: 0.22
                    });
                    const geo = new THREE.CircleGeometry(1.18, 64); // さらにサイズ拡大
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.set(0, 0, 0.25);
                    // 光沢ハイライト（半透明の白い円盤）
                    const glossGeo = new THREE.CircleGeometry(1.05, 64);
                    const glossMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 });
                    const gloss = new THREE.Mesh(glossGeo, glossMat);
                    gloss.position.set(0, 0.13, 0.28);
                    mesh.add(gloss);
                    // グロー（淡い黄色の大円）
                    const glowGeo = new THREE.CircleGeometry(1.32, 64);
                    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6, transparent: true, opacity: 0.18 });
                    const glow = new THREE.Mesh(glowGeo, glowMat);
                    glow.position.set(0, 0, 0.21);
                    mesh.add(glow);
                    // リムライト（外周の細い白円）
                    const rimGeo = new THREE.RingGeometry(1.13, 1.18, 64);
                    const rimMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
                    const rim = new THREE.Mesh(rimGeo, rimMat);
                    rim.position.set(0, 0, 0.26);
                    mesh.add(rim);
                    roulette.add(mesh);
                }
            );

            // ライティング
            const spot = new THREE.SpotLight(0xffffff, 1.2, 20, Math.PI / 3, 0.5, 1);
            spot.position.set(0, 6, 8);
            spot.target.position.set(0, 0, 0);
            scene.add(spot);
            scene.add(spot.target);
            const ambient = new THREE.AmbientLight(0xfff6e0, 0.7);
            scene.add(ambient);

            scene.add(roulette);
        };

        const createTexture = (index: number) => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d')!;
            // --- セクターごとに明確な色分けと明るいグラデーション ---
            // より明るく高彩度なカジノ配色
            const casinoColors = [
                'hsl(48, 100%, 70%)',   // ゴールド
                'hsl(0, 100%, 60%)',    // 赤
                'hsl(120, 80%, 55%)',   // 緑
                'hsl(220, 90%, 65%)',   // 青
                'hsl(280, 80%, 70%)',   // 紫
                'hsl(0, 0%, 95%)'       // シルバー
            ];
            const colorIdx = index % casinoColors.length;
            const baseColor = casinoColors[colorIdx];
            // --- 明るいグラデーション ---
            const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
            grad.addColorStop(0, '#fffbe6');
            grad.addColorStop(0.13, baseColor);
            grad.addColorStop(0.38, baseColor);
            grad.addColorStop(0.7, 'rgba(255,255,255,0.13)');
            grad.addColorStop(1, '#ffe066');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);

            // --- 光沢ハイライト（中央上部に楕円） ---
            ctx.save();
            ctx.globalAlpha = 0.22;
            ctx.beginPath();
            ctx.ellipse(256, 140, 170, 48, Math.PI / 7, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.filter = 'blur(2.5px)';
            ctx.fill();
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            ctx.restore();

            // --- セクターのテキスト ---
            ctx.font = 'bold 38px "Segoe UI", "Arial", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 8;
            const prize = props.prizes[index];
            const label = prize ? prize.name : `#${index + 1}`;
            ctx.fillStyle = '#222';
            ctx.fillText(label, 256, 420);
            ctx.shadowBlur = 0;

            // --- 画像 ---
            const texture = new THREE.CanvasTexture(canvas);
            if (prize && (prize.imageDataUrl || prize.imageAssetId)) {
                const img = new window.Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    // 画像を中央に大きく表示
                    const iw = 180, ih = 180;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(256, 200, 80, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(img, 256 - iw / 2, 110, iw, ih);
                    // リムライト（白い円形グロー）
                    ctx.globalAlpha = 0.22;
                    ctx.beginPath();
                    ctx.arc(256, 200, 80, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 8;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    ctx.restore();
                    texture.needsUpdate = true;
                };
                img.src = prize.imageDataUrl || prize.imageAssetId || '';
            }
            return texture;
        };

        // パーティクル演出用
        let particles: THREE.Points | null = null;
        let particleLife = 0;

        const animate = () => {
            requestAnimationFrame(animate);
            // 当たり時パーティクル
            if (particles && particleLife > 0) {
                particles.rotation.z += 0.01;
                particleLife--;
                if (particleLife <= 0) {
                    scene.remove(particles);
                    particles = null;
                }
            }
            // --- 背景パーティクルをランダムにキラッと光らせる ---
            if (bgParticles) {
                const time = performance.now() * 0.002;
                const colors = bgParticles.geometry.attributes.color;
                for (let i = 0; i < colors.count; i++) {
                    let flicker = 1 + 0.7 * Math.sin(time + i * 0.7 + Math.sin(i));
                    if (Math.random() > 0.98) flicker += Math.random() * 1.5;
                    colors.setX(i, Math.min(1, colors.getX(i) * flicker));
                    colors.setY(i, Math.min(1, colors.getY(i) * flicker));
                    colors.setZ(i, Math.min(1, colors.getZ(i) * flicker));
                }
                colors.needsUpdate = true;
            }
            // --- リングハイライトを回転に追従させて動かす ---
            if (ringHighlight && roulette) {
                // ルーレットの回転角度に応じてハイライトの位置を動かす
                const t = (performance.now() * 0.00025) % 1;
                ringHighlight.rotation.z = roulette.rotation.z + t * Math.PI * 2;
            }
            if (renderer) renderer.render(scene, camera);
        };


        const toggleSpin = () => {
            if (spinning) stopSpin(); else startSpin();
        };

        const startSpin = () => {
            spinning = true;
            // 高速回転（2倍速）
            gsap.to(roulette.rotation, {
                z: "+=" + Math.PI * 2,
                duration: 0.6,
                ease: "linear",
                repeat: -1
            });
        };

        const stopSpin = () => {
            gsap.killTweensOf(roulette.rotation);
            // ジャックポット感のある停止演出（急減速→バウンド→ピタッ）
            const currentZ = roulette.rotation.z;
            const targetZ = Math.ceil(currentZ / (Math.PI * 2)) * (Math.PI * 2); // ちょうど一周分で止める
            gsap.to(roulette.rotation, {
                z: targetZ + Math.PI * 1.5,
                duration: 1.1,
                ease: "power4.inOut",
                onComplete: () => {
                    gsap.to(roulette.rotation, {
                        z: targetZ + Math.PI * 2,
                        duration: 1.2,
                        ease: "bounce.out",
                        onComplete: () => {
                            spinning = false;
                        }
                    });
                }
            });
        };


        // 当たり時のエフェクト
        function showWinEffect(targetIndex: number) {
            // セクターを発光
            if (roulette.children[targetIndex + 1]) { // +1: ring分
                const mesh = roulette.children[targetIndex + 1] as THREE.Mesh;
                const mat = mesh.material as THREE.MeshPhysicalMaterial;
                mat.emissive.set(0xfff200);
                mat.emissiveIntensity = 0.7;
                setTimeout(() => {
                    mat.emissiveIntensity = 0.08;
                }, 1200);
            }
            // パーティクル
            if (!particles) {
                const geo = new THREE.BufferGeometry();
                const N = 80;
                const pos = new Float32Array(N * 3);
                for (let i = 0; i < N; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const r = 2.7 + Math.random() * 1.2;
                    pos[i * 3] = Math.cos(a) * r;
                    pos[i * 3 + 1] = Math.sin(a) * r;
                    pos[i * 3 + 2] = 0.3 + Math.random() * 0.5;
                }
                geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                const mat = new THREE.PointsMaterial({ color: 0xffe066, size: 0.18, transparent: true, opacity: 0.85 });
                particles = new THREE.Points(geo, mat);
                scene.add(particles);
                particleLife = 60;
            }
        }

        watch(() => props.showResult, () => {
            if (props.showResult && props.selectedPrize) {
                const sectors = Math.max(6, props.prizes.length);
                const sectorAngle = (Math.PI * 2) / sectors;
                const selectedIndex = props.prizes.findIndex(p => p.id === props.selectedPrize?.id);
                const targetIndex = selectedIndex >= 0 ? selectedIndex : Math.floor(Math.random() * sectors);
                // 上部インジケーターに当たるように調整
                const targetAngle = - (targetIndex * sectorAngle + sectorAngle / 2) + Math.PI / 2;
                gsap.to(roulette.rotation, {
                    z: targetAngle,
                    duration: 4.2,
                    ease: 'power3.out',
                    onComplete: () => {
                        showWinEffect(targetIndex);
                    }
                });
            }
        });

        return { canvas, toggleSpin };
    }
};
</script>

<style scoped>
.roulette-label {
    position: absolute;
    bottom: 6%;
    left: 50%;
    transform: translate(-50%, 0);
    font-size: 2rem;
    font-weight: bold;
    color: #fffbe6;
    text-shadow: 0 2px 8px #bfae00, 0 0 16px #fffbe6;
    z-index: 2;
    pointer-events: none;
    letter-spacing: 0.08em;
    background: rgba(0, 0, 0, 0.18);
    padding: 0.2em 1.6em;
    border-radius: 1.2em;
    min-width: 6em;
    box-sizing: border-box;
}

.roulette-animation {
    text-align: center;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 520px;
}

.roulette-canvas-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 420px;
    height: 420px;
    max-width: 90vw;
    max-height: 90vw;
}

canvas {
    border-radius: 50%;
    box-shadow: 0 0 32px 8px #ffe066, 0 0 0 8px #fffbe6 inset;
    background: radial-gradient(ellipse at 60% 30%, #fffbe6 0%, #ffe066 60%, #fffbe6 100%);
    width: 420px;
    height: 420px;
    max-width: 90vw;
    max-height: 90vw;
    display: block;
}


.indicator {
    position: absolute;
    left: 50%;
    z-index: 2;
    filter: drop-shadow(0 0 8px gold);
    pointer-events: none;
    transform: translateX(-50%);
}

.indicator.top {
    top: 18px;
    left: 50%;
    z-index: 3;
    width: 80px;
    height: 80px;
    transform: translateX(-50%) rotate(0deg);
    pointer-events: none;
}

.result-display {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    font-size: 2.2em;
    color: #fffbe6;
    text-shadow: 0 0 8px #ffb700, 0 0 2px #fff;
    font-weight: bold;
    letter-spacing: 0.1em;
    z-index: 3;
    background: rgba(0, 0, 0, 0.18);
    padding: 0.2em 1em;
    border-radius: 1em;
}

.bonus-text,
.mirage-text {
    position: absolute;
    left: 50%;
    bottom: 60px;
    transform: translateX(-50%);
    font-size: 2.2em;
    color: gold;
    text-shadow: 0 0 12px #fffbe6, 0 0 4px #ffb700;
    z-index: 3;
    background: rgba(0, 0, 0, 0.18);
    padding: 0.2em 1em;
    border-radius: 1em;
}
</style>