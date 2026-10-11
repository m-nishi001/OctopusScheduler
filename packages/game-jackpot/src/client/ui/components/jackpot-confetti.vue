<template>
  <canvas ref="canvas" class="jp-confetti" aria-hidden="true" data-testid="jackpot-confetti"></canvas>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";

/**
 * 紙吹雪(軽量な canvas)。マウントされた時点から降らせ、`durationMs` を過ぎたら新しい紙片を出さず、
 * 全て落ち切ったら描画を止める。`prefers-reduced-motion` のときは何も描かない。
 * 投影PCの負荷を抑えるため、紙片数は `count`(既定 140)で頭打ち。
 */
const props = withDefaults(defineProps<{ count?: number; durationMs?: number }>(), {
  count: 140,
  durationMs: 4500,
});

const canvas = ref<HTMLCanvasElement | null>(null);
let raf = 0;
let cleanup: (() => void) | null = null;

onBeforeUnmount(() => cleanup?.());

const COLORS = ["#ffd54a", "#fff2b0", "#c8102e", "#ff5470", "#ffffff", "#ff9d2a"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  tilt: number;
}

onMounted(() => {
  const el = canvas.value;
  if (!el) return;
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = el.getContext("2d");
  // canvas を実装していない環境(テスト用のjsdomなど)では何も描かない
  if (!ctx || typeof ctx.save !== "function" || typeof ctx.fillRect !== "function") return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    el.width = Math.floor(el.clientWidth * dpr);
    el.height = Math.floor(el.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const w = () => el.clientWidth;
  const h = () => el.clientHeight;
  const pieces: Piece[] = [];
  const spawn = (burst: boolean): Piece => ({
    x: burst ? w() / 2 + (Math.random() - 0.5) * w() * 0.2 : Math.random() * w(),
    y: burst ? h() * 0.45 : -20,
    vx: burst ? (Math.random() - 0.5) * 16 : (Math.random() - 0.5) * 2,
    vy: burst ? -6 - Math.random() * 12 : 2 + Math.random() * 3,
    size: 6 + Math.random() * 8,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tilt: Math.random() * Math.PI * 2,
  });
  // 最初に中央から噴き上げ、その後は上から降らせる
  for (let i = 0; i < Math.floor(props.count * 0.6); i++) pieces.push(spawn(true));

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const dt = Math.min(2, (now - last) / 16.67);
    last = now;
    const spawning = now - start < props.durationMs;
    if (spawning && pieces.length < props.count) {
      for (let i = 0; i < 3 && pieces.length < props.count; i++) pieces.push(spawn(false));
    }
    ctx.clearRect(0, 0, w(), h());
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.vy += 0.18 * dt;
      p.vx *= 0.995;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.tilt += 0.1 * dt;
      if (p.y > h() + 30) {
        pieces.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.tilt));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (spawning || pieces.length > 0) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, w(), h());
  };
  raf = requestAnimationFrame(frame);

  cleanup = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  };
});
</script>

<style scoped>
.jp-confetti {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
