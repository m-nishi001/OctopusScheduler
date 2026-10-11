import { InternalRouletteItem } from "./roulette-image-loader";
import { calculateSectorAngle } from "./roulette-angle-utils";

/**
 * 画像の無い賞品の扇に、賞品名を放射方向に描く。扇の幅・半径に収まるよう文字サイズを調整し、
 * 長い名前は末尾を「…」で省略する(扇が多いほど文字は小さくなる)。
 */
function drawSectorLabel(
  ctx: CanvasRenderingContext2D,
  name: string,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  sectorAngle: number
) {
  const text = (name ?? "").trim();
  if (!text) return;
  const midAngle = startAngle + sectorAngle / 2;
  const maxLen = radius * 0.62; // 中心のつまみを避けた、半径方向に使える長さ
  const maxHeight = Math.max(8, 2 * radius * 0.6 * Math.tan(sectorAngle / 2) * 0.8);
  let fontSize = Math.min(radius * 0.11, maxHeight);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(midAngle);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const setFont = () => (ctx.font = `900 ${Math.floor(fontSize)}px sans-serif`);
  setFont();
  const measure = (t: string) => ctx.measureText(t).width;
  let label = Array.from(text);
  // 長すぎるときは、まず文字を縮め、それでも収まらなければ省略する
  while (fontSize > 10 && measure(label.join("")) > maxLen) {
    fontSize -= 1;
    setFont();
  }
  while (label.length > 1 && measure(label.join("")) > maxLen) {
    label = label.slice(0, -1);
    label[label.length - 1] = "…";
  }
  const out = label.join("");
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, fontSize * 0.18);
  ctx.strokeStyle = "rgba(42, 18, 10, 0.9)";
  ctx.fillStyle = "#fff8e1";
  ctx.strokeText(out, radius * 0.9, 0);
  ctx.fillText(out, radius * 0.9, 0);
  ctx.restore();
}

export function drawSector(
  i: number,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number,
  currentRouletteItems: InternalRouletteItem[],
  ctx: CanvasRenderingContext2D,
  sectorAngle: number
) {
  const startAngle = i * sectorAngle - rotation;
  const endAngle = (i + 1) * sectorAngle - rotation;

  // ジャックポットのゴールド/コーラル系テーマに合わせた暖色パレット
  // (home.vue等の演出画面と統一)。汎用のレインボー配色から変更。
  const colors = [
    "#ffd36f",
    "#ff7aa0",
    "#e8b04b",
    "#c9536b",
    "#ffb347",
    "#8a3b5a",
    "#ff9466",
    "#a8672f",
  ];
  ctx.fillStyle = colors[i % colors.length];
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#2a120a";
  ctx.lineWidth = Math.max(1, radius * 0.01);
  ctx.stroke();

  const midAngle = startAngle + sectorAngle / 2;
  // 項目が8個未満でもホイールは最低8分割で描くため、足りない扇は項目を巡回させて埋める
  // (空の扇が出ない/存在しない項目を読んで落ちない)。停止位置の計算は元の項目の添字のまま。
  const item =
    currentRouletteItems.length > 0
      ? currentRouletteItems[i % currentRouletteItems.length]
      : undefined;
  if (item && item.hasImage === false) {
    drawSectorLabel(ctx, item.name, centerX, centerY, radius, startAngle, sectorAngle);
    return;
  }
  const img = item?.imageElement;
  if (!img) return;

  const innerRadius = Math.max(6, Math.floor(radius * 0.05));
  const outerRadius = Math.min(radius - 6, Math.floor(radius * 0.98));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(
    centerX + Math.cos(startAngle) * innerRadius,
    centerY + Math.sin(startAngle) * innerRadius
  );
  ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
  ctx.lineTo(
    centerX + Math.cos(endAngle) * innerRadius,
    centerY + Math.sin(endAngle) * innerRadius
  );
  ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.clip();

  const radialCenter = (innerRadius + outerRadius) / 2;
  const halfSectorAngleLocal = sectorAngle / 2;
  const availableWidth = Math.max(
    4,
    2 * radialCenter * Math.tan(halfSectorAngleLocal) * 0.98
  );
  const availableHeight = Math.max(4, outerRadius - innerRadius - 2);

  const desiredImgSize = radius * 0.4;
  const imgNaturalW = img.naturalWidth || img.width || desiredImgSize;
  const imgNaturalH = img.naturalHeight || img.height || desiredImgSize;
  const scale = Math.max(
    availableWidth / imgNaturalW,
    availableHeight / imgNaturalH
  );
  const drawW = imgNaturalW * scale;
  const drawH = imgNaturalH * scale;

  const drawCenterX = centerX + Math.cos(midAngle) * radialCenter;
  const drawCenterY = centerY + Math.sin(midAngle) * radialCenter;

  ctx.save();
  ctx.translate(drawCenterX, drawCenterY);
  ctx.rotate(midAngle + Math.PI / 2);
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
  ctx.restore();
}

export function drawWheel(
  rotation: number,
  currentRouletteItems: InternalRouletteItem[],
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
) {
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.width / dpr;
  const logicalHeight = canvas.height / dpr;
  const centerX = Math.round(logicalWidth / 2);
  const centerY = Math.round(logicalHeight / 2);
  const radius = (Math.min(logicalWidth, logicalHeight) / 2) * 0.88;

  // Safe clearRect: reset transform to clear the entire buffer
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const sectors = Math.max(8, currentRouletteItems.length);
  const sectorAngle = calculateSectorAngle(currentRouletteItems.length);

  for (let i = 0; i < sectors; i++) {
    drawSector(
      i,
      centerX,
      centerY,
      radius,
      rotation,
      currentRouletteItems,
      ctx,
      sectorAngle
    );
  }

  ctx.fillStyle = "#FFD700";
  const knobRadius = radius * 0.15;
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    knobRadius
  );
  gradient.addColorStop(0, "#FFD700");
  gradient.addColorStop(1, "#FFA500");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, knobRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.shadowColor = "#FFD700";
  ctx.shadowBlur = 10;
}
