<template>
    <div class="roulette-container" :class="{ spinning }" tabindex="0" @keydown.enter="startSpin()">
        <canvas ref="canvas" width="500" height="500"></canvas>
        <div class="indicator">▼</div>
        <div v-if="showResult" class="result">{{ selectedPrize?.name }}</div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAudio } from '@shared-composables/use-audio';
import type { PrizeDto } from '@model/applications/prize/dto/prize-dto';
import { defineExpose } from 'vue';
import type { AnimationRef } from './animation-types';

export type RouletteRef = AnimationRef;

export default {
    name: 'RouletteAnimation',
    props: {
        prizes: { type: Array as () => PrizeDto[], default: () => [] },
        selectedPrize: { type: Object as () => PrizeDto | null, default: null },
        showResult: { type: Boolean, default: false },
    },
    emits: ['stopped'],
    setup(props, { emit }) {
        const canvas = ref<HTMLCanvasElement | null>(null);
        let ctx: CanvasRenderingContext2D | null = null;
        let animationId: number | null = null;
        let rotation = 0;
        let spinning = false;
        let speed = 0;
        // useAudio を使って BGM を再生（object URL 管理は useAudio 側で行う）
        const { load: loadBgm, play: playBgm, stop: stopBgm } = useAudio({ mode: 'html-audio' });
        const images: (HTMLImageElement | null)[] = [];

        const sectors = Math.max(8, props.prizes.length);
        const sectorAngle = (Math.PI * 2) / sectors;

        onMounted(async () => {
            if (!canvas.value) return;
            ctx = canvas.value.getContext('2d');
            if (!ctx) return;

            await loadImages();
            draw();
            animate();
        });

        const loadImages = async () => {
            for (const prize of props.prizes) {
                if (prize.imageAssetId) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = prize.imageAssetId;
                    const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
                        img.onload = () => resolve(img);
                        img.onerror = () => resolve(null);
                    });
                    images.push(loadedImg);
                } else {
                    images.push(null);
                }
            }
            while (images.length < sectors) {
                images.push(null);
            }
        };

        const draw = () => {
            if (!ctx || !canvas.value) return;
            ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
            const centerX = canvas.value.width / 2;
            const centerY = canvas.value.height / 2;
            const radius = 200;

            for (let i = 0; i < sectors; i++) {
                const startAngle = i * sectorAngle + rotation;
                const endAngle = (i + 1) * sectorAngle + rotation;

                const colors = ['#FFD700', '#FF4500', '#00FF00', '#0080FF', '#800080', '#FF8C00', '#FF0000', '#00FFFF'];
                ctx.fillStyle = colors[i % colors.length];
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, startAngle, endAngle);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.stroke();

                const midAngle = startAngle + sectorAngle / 2;
                const imgX = centerX + Math.cos(midAngle) * (radius * 0.6);
                const imgY = centerY + Math.sin(midAngle) * (radius * 0.6);
                const imgSize = 60;

                const img = images[i];
                if (img) {
                    ctx.save();
                    ctx.translate(imgX, imgY);
                    ctx.rotate(midAngle + Math.PI / 2);
                    ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#000';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(props.prizes[i]?.name || `Prize ${i + 1}`, imgX, imgY);
                }
            }

            ctx.fillStyle = '#FFD700';
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
            gradient.addColorStop(0, '#FFD700');
            gradient.addColorStop(1, '#FFA500');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 10;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('JACKPOT', centerX, centerY + 5);
        };

        const animate = () => {
            if (spinning) {
                // Add some fluctuation for excitement
                const fluctuation = Math.sin(Date.now() * 0.01) * 0.02;
                rotation += speed + fluctuation;
            }
            draw();
            animationId = requestAnimationFrame(animate);
        };

        const startSpin = async (bgm1Url?: Blob | null) => {
            if (bgm1Url) {
                try {
                    await stopBgm();
                    await loadBgm(bgm1Url);
                    await playBgm({ isRepeat: true });
                } catch { /* ignore audio errors */ }
            }
            spinning = true;
            speed = 0.2;
            if (!animationId) animate();
        };

        const stopSpin = async (_opts?: { decelerationFunction?: (elapsed: number, totalTime: number, initialSpeed: number) => number }) => {
            return new Promise<string | null>((resolve) => {
                // Calculate target rotation
                let targetIndex = -1;
                if (props.selectedPrize) {
                    targetIndex = props.prizes.findIndex(p => p.id === props.selectedPrize!.id);
                }
                // Calculate target rotation with random offset within sector range (central area)
                const sectorCenter = sectorAngle / 2;
                const randomOffset = sectorCenter + (Math.random() - 0.5) * (sectorAngle / 2);  // Random within central half
                const targetRotation = targetIndex >= 0 ? - (targetIndex * sectorAngle + randomOffset) + Math.PI / 2 : rotation;
                // Initial speed: current speed, adjusted for direction
                const initialSpeed = Math.abs(speed) || 0.2;  // Use current speed or default
                const decelerationStartTime = Date.now();
                // Cancel existing animation
                if (animationId) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }
                // Deceleration animation with smooth convergence
                const decelerate = () => {
                    const elapsed = Date.now() - decelerationStartTime;
                    const progress = Math.min(elapsed / 3000, 1);
                    // Cubic ease-out for smoother deceleration
                    const easeProgress = 1 - Math.pow(1 - progress, 3);
                    speed = initialSpeed * (1 - easeProgress);
                    // Add some fluctuation for excitement (reduce during deceleration)
                    const fluctuation = Math.sin(Date.now() * 0.01) * 0.01 * (1 - progress);
                    // Stronger correction towards target for smooth convergence (only in rotation direction)
                    const currentAngleDiff = ((targetRotation - (rotation + Math.PI / 2) + Math.PI) % (2 * Math.PI)) - Math.PI;
                    const correction = currentAngleDiff > 0 ? currentAngleDiff * 0.05 : 0;  // Only correct if target is ahead
                    rotation += speed + fluctuation + correction;
                    draw();
                    if (progress < 1) {
                        requestAnimationFrame(decelerate);
                    } else {
                        spinning = false;
                        rotation = targetRotation;
                        // After additional 1 second, fully stop
                        setTimeout(() => {
                            stopBgm().catch(() => { /* ignore */ });
                            const prizeId = props.selectedPrize?.id || null;
                            emit('stopped', prizeId);
                            resolve(prizeId);
                        }, 1000);
                    }
                };
                decelerate();
            });
        };

        const runAutoReroll = async (opts: { dummyPrizeId: string | null; finalPrizeId: string | null; dummyDuration: number; finalDuration: number; bgm1Url: Blob | null; bgm2Url: Blob | null }) => {
            // Dummy spin
            if (opts.bgm1Url) {
                try {
                    await stopBgm();
                    await loadBgm(opts.bgm1Url);
                    await playBgm();
                } catch { /* ignore */ }
            }
            spinning = true;
            speed = 0.2;
            await new Promise(resolve => setTimeout(resolve, opts.dummyDuration));
            spinning = false;
            // Set to dummy prize
            if (opts.dummyPrizeId) {
                const targetIndex = props.prizes.findIndex(p => p.id === opts.dummyPrizeId);
                if (targetIndex >= 0) {
                    const targetAngle = - (targetIndex * sectorAngle + sectorAngle / 2) + Math.PI / 2;
                    rotation = targetAngle;
                }
            }
            emit('stopped', opts.dummyPrizeId);  // 1回目: dummy

            // Pause before final
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Final spin
            if (opts.bgm2Url) {
                try {
                    await stopBgm();
                    await loadBgm(opts.bgm2Url);
                    await playBgm();
                } catch { /* ignore */ }
            }
            spinning = true;
            speed = 0.2;
            await new Promise(resolve => setTimeout(resolve, opts.finalDuration));
            spinning = false;
            // Set to final prize
            if (opts.finalPrizeId) {
                const targetIndex = props.prizes.findIndex(p => p.id === opts.finalPrizeId);
                if (targetIndex >= 0) {
                    const targetAngle = - (targetIndex * sectorAngle + sectorAngle / 2) + Math.PI / 2;
                    rotation = targetAngle;
                }
            }
            emit('stopped', opts.finalPrizeId);  // 2回目: final
        };

        onUnmounted(async () => {
            try { await stopBgm(); } catch { }
        });

        return { canvas, startSpin, stopSpin, runAutoReroll, spinning };

        defineExpose<AnimationRef>({
            startSpin,
            stopSpin,
            runAutoReroll,
        });
    }
};
</script>

<style scoped>
.roulette-container {
    position: relative;
    display: inline-block;
    background: radial-gradient(circle, #000 0%, #800000 50%, #FFD700 100%);
    padding: 30px;
    border-radius: 20px;
    box-shadow: 0 0 50px rgba(255, 215, 0, 0.8), inset 0 0 50px rgba(0, 0, 0, 0.5);
    border: 5px solid #FFD700;
}

canvas {
    border: 8px solid #FFD700;
    border-radius: 50%;
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.5), 0 0 90px rgba(0, 0, 255, 0.3);
    animation: pulse 1s infinite;
    transition: box-shadow 0.3s ease;
}

.spinning canvas {
    animation: spinPulse 0.3s infinite;
}

@keyframes pulse {

    0%,
    100% {
        box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.5), 0 0 90px rgba(0, 0, 255, 0.3);
    }

    50% {
        box-shadow: 0 0 50px rgba(255, 215, 0, 1), 0 0 80px rgba(255, 0, 0, 0.8), 0 0 120px rgba(0, 0, 255, 0.5);
    }
}

@keyframes spinPulse {

    0%,
    100% {
        box-shadow: 0 0 50px rgba(255, 215, 0, 1), 0 0 80px rgba(255, 0, 0, 0.8), 0 0 120px rgba(0, 0, 255, 0.5);
        transform: scale(1);
    }

    50% {
        box-shadow: 0 0 70px rgba(255, 215, 0, 1.2), 0 0 100px rgba(255, 0, 0, 1), 0 0 150px rgba(0, 0, 255, 0.7);
        transform: scale(1.02);
    }
}

.indicator {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 40px;
    color: #FFD700;
    text-shadow: 0 0 20px #FFD700, 0 0 40px #FF4500, 0 0 60px #FFD700;
    animation: indicatorGlow 1.5s infinite;
}

@keyframes indicatorGlow {

    0%,
    100% {
        text-shadow: 0 0 20px #FFD700, 0 0 40px #FF4500, 0 0 60px #FFD700;
    }

    50% {
        text-shadow: 0 0 30px #FFD700, 0 0 60px #FF4500, 0 0 90px #FFD700;
    }
}

.result {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 28px;
    color: #FFD700;
    font-weight: bold;
    text-shadow: 0 0 15px #FFD700, 0 0 30px #FF4500;
    background: rgba(0, 0, 0, 0.8);
    padding: 10px 20px;
    border-radius: 10px;
    border: 2px solid #FFD700;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    animation: resultPop 0.5s ease-out;
}

@keyframes resultPop {
    0% {
        transform: translateX(-50%) scale(0);
        opacity: 0;
    }

    100% {
        transform: translateX(-50%) scale(1);
        opacity: 1;
    }
}
</style>
