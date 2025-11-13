import { InternalRouletteItem } from "./roulette-image-loader";
import { calculateSectorAngle } from "./roulette-angle-utils";

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

  const colors = [
    "#FFD700",
    "#FF4500",
    "#00FF00",
    "#0080FF",
    "#800080",
    "#FF8C00",
    "#FF0000",
    "#00FFFF",
  ];
  ctx.fillStyle = colors[i % colors.length];
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.stroke();

  const midAngle = startAngle + sectorAngle / 2;
  const img = currentRouletteItems[i].imageElement;
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

  const desiredImgSize = 80;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 200;
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
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    30
  );
  gradient.addColorStop(0, "#FFD700");
  gradient.addColorStop(1, "#FFA500");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.shadowColor = "#FFD700";
  ctx.shadowBlur = 10;
}
