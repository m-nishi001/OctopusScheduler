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
import { container } from 'tsyringe';
import { AssetDataService } from '@model/applications/asset/asset-data-service';

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
        const assetService = container.resolve(AssetDataService);

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
                if (prize.imageDataUrl) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = prize.imageDataUrl;
                    const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
                        img.onload = () => {
                            console.log('Loaded image from imageDataUrl for prize:', prize.id);
                            resolve(img);
                        };
                        img.onerror = () => {
                            console.error('Failed to load image from imageDataUrl for prize:', prize.id);
                            resolve(null);
                        };
                    });
                    images.push(loadedImg);
                } else if (prize.imageAssetId) {
                    try {
                        const asset = await assetService.getAssetDataById(prize.imageAssetId);
                        if (asset && asset.blob) {
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            const objectUrl = URL.createObjectURL(asset.blob);
                            img.src = objectUrl;
                            const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
                                img.onload = () => {
                                    console.log('Loaded image from asset for prize:', prize.id);
                                    URL.revokeObjectURL(objectUrl); // Clean up after loading
                                    resolve(img);
                                };
                                img.onerror = () => {
                                    console.error('Failed to load image from asset for prize:', prize.id);
                                    URL.revokeObjectURL(objectUrl);
                                    resolve(null);
                                };
                            });
                            images.push(loadedImg);
                        } else {
                            console.warn('Asset not found for prize:', prize.id, 'using default');
                            // Use default image if asset not found
                            const img = new Image();
                            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjY2NjIi8+CiAgPHRleHQgeD0iMzAiIHk9IjM1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMwMDAiPlByaXplPC90ZXh0Pgo8L3N2Zz4=';
                            const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
                                img.onload = () => {
                                    console.log('Loaded default image for prize:', prize.id);
                                    resolve(img);
                                };
                                img.onerror = () => {
                                    console.error('Failed to load default image for prize:', prize.id);
                                    resolve(null);
                                };
                            });
                            images.push(loadedImg);
                        }
                    } catch (error) {
                        console.error('Failed to load image for prize:', prize.id, error);
                        // Use default image on error
                        const img = new Image();
                        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjY2NjIi8+CiAgPHRleHQgeD0iMzAiIHk9IjM1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMwMDAiPlByaXplPC90ZXh0Pgo8L3N2Zz4=';
                        const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
                            img.onload = () => {
                                console.log('Loaded default image on error for prize:', prize.id);
                                resolve(img);
                            };
                            img.onerror = () => {
                                console.error('Failed to load default image on error for prize:', prize.id);
                                resolve(null);
                            };
                        });
                        images.push(loadedImg);
                    }
                } else {
                    console.warn('No image for prize:', prize.id, 'using default');
                    // Use default image if no image provided
                    const img = new Image();
                    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjY2NjIi8+CiAgPHRleHQgeD0iMzAiIHk9IjM1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMwMDAiPlByaXplPC90ZXh0Pgo8L3N2Zz4=';
                    const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
                        img.onload = () => {
                            console.log('Loaded default image for no image prize:', prize.id);
                            resolve(img);
                        };
                        img.onerror = () => {
                            console.error('Failed to load default image for no image prize:', prize.id);
                            resolve(null);
                        };
                    });
                    images.push(loadedImg);
                }
            }
            while (images.length < sectors) {
                console.log('Filling remaining sectors with default image');
                // Fill remaining sectors with default image
                const img = new Image();
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjY2NjIi8+CiAgPHRleHQgeD0iMzAiIHk9IjM1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMwMDAiPlByaXplPC90ZXh0Pgo8L3N2Zz4=';
                const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
                    img.onload = () => {
                        console.log('Loaded default image for remaining sector');
                        resolve(img);
                    };
                    img.onerror = () => {
                        console.error('Failed to load default image for remaining sector');
                        resolve(null);
                    };
                });
                images.push(loadedImg);
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
                // Place images closer to outer rim so they don't overlap the center
                const desiredImgSize = 80;

                const img = images[i];
                if (img) {
                    // Define an inner/outer radius for the image band so images sit in a ring
                    // Fill sectors from near-center to almost outer rim so images cover whole wedge
                    const innerRadius = Math.max(6, Math.floor(radius * 0.05));
                    const outerRadius = Math.min(radius - 6, Math.floor(radius * 0.98));

                    // Estimate angular half-width of the image at the current distance if needed

                    // Clip to a sector-shaped path (ring wedge) so the image never spills into neighbors
                    ctx.save();
                    ctx.beginPath();
                    // outer arc from start to end
                    ctx.moveTo(centerX + Math.cos(startAngle) * innerRadius, centerY + Math.sin(startAngle) * innerRadius);
                    ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
                    // line to inner arc end
                    ctx.lineTo(centerX + Math.cos(endAngle) * innerRadius, centerY + Math.sin(endAngle) * innerRadius);
                    // inner arc back (reverse)
                    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
                    ctx.closePath();
                    ctx.clip();

                    // Compute a radial band that the image should fill
                    const radialCenter = (innerRadius + outerRadius) / 2;
                    const halfSectorAngleLocal = sectorAngle / 2;

                    // Compute available width at radialCenter for the sector (tangential span)
                    const availableWidth = Math.max(4, 2 * radialCenter * Math.tan(halfSectorAngleLocal) * 0.98); // 98% margin
                    const availableHeight = Math.max(4, outerRadius - innerRadius - 2); // small vertical padding

                    // Preserve aspect ratio and perform 'cover' scaling so the image fills the wedge
                    const imgNaturalW = img.naturalWidth || img.width || desiredImgSize;
                    const imgNaturalH = img.naturalHeight || img.height || desiredImgSize;
                    const scale = Math.max(availableWidth / imgNaturalW, availableHeight / imgNaturalH);
                    const drawW = imgNaturalW * scale;
                    const drawH = imgNaturalH * scale;

                    // Draw centered at radialCenter along midAngle, rotated so width follows tangential direction
                    const drawCenterX = centerX + Math.cos(midAngle) * radialCenter;
                    const drawCenterY = centerY + Math.sin(midAngle) * radialCenter;

                    ctx.save();
                    // Clip already applied; now transform and draw
                    ctx.translate(drawCenterX, drawCenterY);
                    ctx.rotate(midAngle + Math.PI / 2);
                    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                    ctx.restore();

                    ctx.restore();
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
            // Center decoration left intentionally empty (no text)
            ctx.fillStyle = '#000';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 10;
            // Text removed as requested
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
