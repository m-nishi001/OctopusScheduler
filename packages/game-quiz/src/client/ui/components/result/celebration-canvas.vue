<template>
    <div class="celebration" aria-hidden="true">
        <canvas ref="canvasRef" class="fx-canvas"></canvas>
        <transition name="banner">
            <div v-if="active && winnerName" class="banner">
                <div class="banner-label">🎉 1位 おめでとう！ 🎉</div>
                <div class="banner-name">{{ winnerName }}</div>
            </div>
        </transition>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
    /** true の間、演出を再生する */
    active: boolean;
    winnerName: string;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

const COLORS = ['#ffd700', '#ff4d4d', '#4dff88', '#4da6ff', '#ff4dff', '#ffff4d', '#ff7a1a', '#4dffff'];
const MAX_PARTICLES = 900;
const GRAVITY = 900; // px/s^2

type Kind = 'spark' | 'ribbon' | 'star' | 'dot' | 'rocket';
interface Particle {
    kind: Kind;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number; // remaining sec
    maxLife: number;
    size: number;
    color: string;
    rot: number;
    vrot: number;
    wobble: number;
    drag: number;
    gravity: number;
    trail: boolean;
    burstAt?: number; // rocket: y at which it explodes
}

let particles: Particle[] = [];
let ctx: CanvasRenderingContext2D | null = null;
let rafId = 0;
let lastTs = 0;
let width = 0;
let height = 0;
let dpr = 1;
let timers: ReturnType<typeof setTimeout>[] = [];
let confettiAccumulator = 0;
let confettiUntil = 0; // ms timestamp
let reducedMotion = false;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)]!;

function push(p: Particle) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push(p);
}

function resize() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function launchRocket() {
    const x = rand(width * 0.12, width * 0.88);
    push({
        kind: 'rocket', x, y: height + 10, vx: rand(-40, 40), vy: -rand(height * 0.9, height * 1.25),
        life: 3, maxLife: 3, size: 3, color: '#fff3b0', rot: 0, vrot: 0, wobble: 0,
        drag: 0, gravity: 500, trail: true, burstAt: rand(height * 0.15, height * 0.45),
    });
}

function explode(x: number, y: number, big = false) {
    const base = pick();
    const alt = pick();
    const count = big ? 120 : 80;
    for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + rand(-0.05, 0.05);
        const speed = rand(120, big ? 420 : 320);
        push({
            kind: 'spark', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
            life: rand(0.9, 1.6), maxLife: 1.6, size: rand(1.5, 3), color: i % 3 === 0 ? alt : base,
            rot: 0, vrot: 0, wobble: 0, drag: 1.6, gravity: 160, trail: true,
        });
    }
}

function spawnConfetti(n: number) {
    const kinds: Kind[] = ['ribbon', 'ribbon', 'star', 'dot'];
    for (let i = 0; i < n; i++) {
        const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
        push({
            kind, x: rand(0, width), y: -20, vx: rand(-60, 60), vy: rand(80, 220),
            life: rand(4, 7), maxLife: 7, size: rand(7, 14), color: pick(),
            rot: rand(0, Math.PI * 2), vrot: rand(-6, 6), wobble: rand(0, Math.PI * 2),
            drag: 0.3, gravity: 120, trail: false,
        });
    }
}

function drawStar(c: CanvasRenderingContext2D, r: number) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    c.closePath();
    c.fill();
}

function step(dt: number, now: number) {
    if (now < confettiUntil) {
        confettiAccumulator += dt * (reducedMotion ? 25 : 90);
        const n = Math.floor(confettiAccumulator);
        confettiAccumulator -= n;
        spawnConfetti(n);
    }
    const next: Particle[] = [];
    for (const p of particles) {
        p.life -= dt;
        if (p.life <= 0) continue;
        p.vy += p.gravity * dt;
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy *= p.drag > 0 && p.kind === 'spark' ? damp : 1;
        p.wobble += dt * 4;
        p.x += (p.vx + (p.kind === 'ribbon' ? Math.sin(p.wobble) * 40 : 0)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        if (p.kind === 'rocket' && (p.vy >= -40 || p.y <= (p.burstAt ?? 0))) {
            explode(p.x, p.y, Math.random() < 0.3);
            continue;
        }
        if (p.y > height + 40) continue;
        next.push(p);
    }
    particles = next;
}

function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
        if (p.kind === 'spark' || p.kind === 'rocket') {
            const alpha = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.6)));
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
            ctx.stroke();
        }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of particles) {
        if (p.kind === 'spark' || p.kind === 'rocket') continue;
        ctx.globalAlpha = Math.min(1, p.life / 1.2);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.kind === 'ribbon') {
            // 回転に応じて幅が潰れて、ひらひら見える
            ctx.scale(1, Math.cos(p.wobble * 1.5));
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.kind === 'star') {
            drawStar(ctx, p.size * 0.7);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

function loop(ts: number) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    step(dt, ts);
    render();
    if (particles.length > 0 || ts < confettiUntil) {
        rafId = requestAnimationFrame(loop);
    } else {
        rafId = 0;
        ctx?.clearRect(0, 0, width, height);
    }
}

function ensureLoop() {
    if (rafId === 0) {
        lastTs = performance.now();
        rafId = requestAnimationFrame(loop);
    }
}

function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
}

function start() {
    resize();
    clearTimers();
    reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    confettiUntil = performance.now() + (reducedMotion ? 3000 : 5500);
    if (!reducedMotion) {
        // 開幕: 中央で大きな花火 + 連続打ち上げ
        explode(width / 2, height * 0.3, true);
        for (let i = 0; i < 9; i++) {
            timers.push(setTimeout(launchRocket, 250 + i * 520 + rand(0, 200)));
        }
    }
    ensureLoop();
}

function stop() {
    clearTimers();
    confettiUntil = 0;
    particles = particles.filter((p) => p.kind !== 'rocket');
}

watch(() => props.active, (v) => (v ? start() : stop()));

onMounted(() => {
    resize();
    window.addEventListener('resize', resize);
    if (props.active) start();
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', resize);
    clearTimers();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    particles = [];
});
</script>

<style scoped>
.celebration {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 50;
}

.fx-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.banner {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(92%, 900px);
    padding: 24px 28px;
    text-align: center;
    border-radius: 24px;
    background: radial-gradient(ellipse at center, rgba(40, 24, 0, 0.82), rgba(0, 0, 0, 0.55));
    border: 2px solid rgba(255, 215, 0, 0.8);
    box-shadow: 0 0 60px rgba(255, 215, 0, 0.55), inset 0 0 40px rgba(255, 215, 0, 0.2);
}

.banner-label {
    font-size: clamp(1.4rem, 5vw, 3rem);
    font-weight: 900;
    letter-spacing: 0.05em;
    color: #ffe27a;
    text-shadow: 0 0 18px rgba(255, 215, 0, 0.9), 0 3px 0 #8a5a00;
}

.banner-name {
    margin-top: 10px;
    font-size: clamp(2rem, 9vw, 5.5rem);
    font-weight: 900;
    line-height: 1.15;
    color: #fff;
    text-shadow: 0 0 24px rgba(255, 255, 255, 0.7), 0 4px 0 #b8860b;
    overflow-wrap: anywhere;
    animation: namePulse 1s ease-in-out infinite alternate;
}

@keyframes namePulse {
    to {
        transform: scale(1.06);
    }
}

.banner-enter-active {
    transition: transform 0.7s cubic-bezier(0.2, 1.6, 0.4, 1), opacity 0.4s ease;
}

.banner-leave-active {
    transition: transform 0.6s ease-in, opacity 0.6s ease-in;
}

.banner-enter-from {
    transform: translate(-50%, -50%) scale(0.2) rotate(-8deg);
    opacity: 0;
}

.banner-leave-to {
    transform: translate(-50%, -80%) scale(0.8);
    opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
    .banner-name {
        animation: none;
    }
}
</style>
