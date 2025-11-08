import { ref, onMounted, onUnmounted } from "vue";
import { useAudio } from "@shared-composables/use-audio";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import { container } from "tsyringe";
import { AssetDataService } from "@model/applications/asset/asset-data-service";

export interface RenderPrize extends PrizeDto {
  imageSrc?: string;
  imageElement?: HTMLImageElement;
}

export interface RouletteAnimationProps {
  prizes: RenderPrize[];
  selectedPrize: RenderPrize;
  showResult: boolean;
}

export type RouletteAnimationEmits = (
  event: "stopped",
  prizeId: string | null
) => void;

export interface RouletteAnimationRef {
  startSpin: (bgm1Url?: Blob | null) => Promise<void>;
  stopSpin: (
    durationSec: number,
    targetPrizeId: string | null
  ) => Promise<string | null>;
}

export type RouletteRef = RouletteAnimationRef;

export type UseRouletteOptions = {
  raf?: (cb: FrameRequestCallback) => number;
  cancelRaf?: (id: number) => void;
  now?: () => number;
  emitDelayMs?: number;
  initialPrizes?: RenderPrize[];
};

export function useRouletteAnimation(
  props: RouletteAnimationProps,
  emit: RouletteAnimationEmits,
  opts?: UseRouletteOptions
) {
  const canvas = ref<HTMLCanvasElement | null>(null);
  let ctx: CanvasRenderingContext2D | null = null;
  let animationId: number | null = null;
  let rotation = 0;
  let spinning = ref(false);
  let lastTimestamp: number | null = null;

  const {
    load: loadBgm,
    play: playBgm,
    stop: stopBgm,
  } = useAudio({
    mode: "html-audio",
  });
  const images: (HTMLImageElement | null)[] = [];

  // Keep an internal mutable reference to the prizes array so callers can
  // update it later via `updatePrizes`. Prefer prepared initial prizes
  // if provided via `opts.initialPrizes` (these are `RenderPrize[]`).
  let currentPrizes: RenderPrize[] =
    (opts && opts.initialPrizes) ?? (props.prizes as RenderPrize[]);

  const getSectors = () => Math.max(8, currentPrizes.length);
  const getSectorAngle = () => (Math.PI * 2) / getSectors();

  // timing hooks (injectable for tests)
  const raf = opts?.raf ?? globalThis.requestAnimationFrame.bind(globalThis);
  const cancelRaf =
    opts?.cancelRaf ?? globalThis.cancelAnimationFrame.bind(globalThis);

  /**
   * nowFn: a pluggable time source (milliseconds). Keep this abstraction so
   * unit tests and non-browser environments can inject a deterministic clock
   * (via `opts.now`). Do NOT remove or inline calls to `nowFn` without
   * considering testability and environment compatibility. Default falls back
   * to `performance.now()` in browsers.
   */
  const nowFn = opts?.now ?? (() => performance.now());

  const emitDelayMs = opts?.emitDelayMs ?? 1000;

  const DEFAULT_SVG_DATAURL =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjY2NjIi8+CiAgPHRleHQgeD0iMzAiIHk9IjM1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMwMDAiPlByaXplPC90ZXh0Pgo8L3N2Zz4=";

  /**
   * Load an image for a single prize. Tries prepared imageSrc/imageElement,
   * then attempts to fetch the asset by imageAssetId, then falls back to a
   * default SVG.
   * Returns an HTMLImageElement or null on failure.
   */
  async function loadImageForPrize(
    prize: RenderPrize
  ): Promise<HTMLImageElement | null> {
    // helper to create an Image from a src and wait for load/error
    const loadFromSrc = (src: string, revokeObjectUrl?: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => {
          if (revokeObjectUrl) URL.revokeObjectURL(revokeObjectUrl);
          resolve(img);
        };
        img.onerror = () => {
          if (revokeObjectUrl) URL.revokeObjectURL(revokeObjectUrl);
          console.error("Failed to load image for prize:", prize.id);
          resolve(null);
        };
      });

    // Priority: explicit HTMLImageElement -> explicit src -> fallback
    // Note: parent component is preferred to resolve imageAssetId -> blob and
    // provide either imageSrc/imageElement. As a robustness measure the hook
    // will attempt to fetch the asset by `imageAssetId` if no prepared image
    // is provided.
    if (prize.imageElement instanceof HTMLImageElement) {
      return prize.imageElement;
    }

    if (prize.imageSrc) {
      return await loadFromSrc(prize.imageSrc);
    }

    // If the prize carries an asset id, try to fetch the asset here as a
    // fallback in case the parent did not prepare an object URL. This makes
    // the rendering logic robust when callers forget to prepare images.
    if (prize.imageAssetId) {
      try {
        const assetService = container.resolve(
          AssetDataService
        ) as AssetDataService;
        const asset = await assetService.getAssetDataById(prize.imageAssetId);
        if (asset && asset.blob) {
          const objectUrl = URL.createObjectURL(asset.blob);
          // Load from the created object URL; revoke after load.
          return await loadFromSrc(objectUrl, objectUrl);
        }
      } catch (e) {
        console.warn("Failed to fetch asset for prize", prize.id, e);
      }
    }

    // fallback default image
    return await loadFromSrc(DEFAULT_SVG_DATAURL);
  }

  /**
   * Ensure images array contains an image element (or null) for each prize and fills
   * remaining sectors with default images so 'images.length >= sectors'.
   */
  async function loadAllImages(): Promise<void> {
    images.length = 0;
    for (const prize of currentPrizes) {
      const img = await loadImageForPrize(prize);
      images.push(img);
    }
    while (images.length < getSectors()) {
      // load a default image for remaining sectors
      images.push(
        await loadImageForPrize({
          id: `__default_${images.length}`,
          imageAssetId: undefined,
        } as unknown as PrizeDto)
      );
    }
  }

  /**
   * Allow parent to replace the prizes array (for example after preparing
   * object URLs / HTMLImageElements). This will reload images and redraw.
   */
  async function updatePrizes(prizes: PrizeDto[]): Promise<void> {
    currentPrizes = prizes;
    await loadAllImages();
    drawWheel();
  }

  /**
   * Draw a single sector wedge and its image (if present).
   */
  function drawSector(
    i: number,
    centerX: number,
    centerY: number,
    radius: number
  ) {
    if (!ctx) return;
    const sectorAngle = getSectorAngle();
    const startAngle = i * sectorAngle + rotation;
    const endAngle = (i + 1) * sectorAngle + rotation;

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
    const img = images[i];
    if (!img) return;

    // Define an inner/outer radius for the image band so images sit in a ring
    const innerRadius = Math.max(6, Math.floor(radius * 0.05));
    const outerRadius = Math.min(radius - 6, Math.floor(radius * 0.98));

    // Clip to a sector-shaped path (ring wedge)
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

    // Compute available drawing area at radial center
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

  /**
   * Draw the wheel (all sectors) and the central decoration.
   */
  function drawWheel() {
    if (!ctx || !canvas.value) return;
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
    const centerX = canvas.value.width / 2;
    const centerY = canvas.value.height / 2;
    const radius = 200;

    for (let i = 0; i < getSectors(); i++) {
      drawSector(i, centerX, centerY, radius);
    }

    // draw center ornament
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

  // Use RAF timestamp to update rotation based on elapsed ms so we can
  // calculate exact rotation at any moment (not tied to frame rate).
  const FRAME_REF_MS = 1000 / 60; // reference frame duration for speed units

  const accelerate = (timestamp: number, initialSpeed: number) => {
    const delta = lastTimestamp ? Math.max(0, timestamp - lastTimestamp) : 0;
    lastTimestamp = timestamp;

    if (spinning.value) {
      // Add some fluctuation for excitement; scale by delta so it's time-consistent
      const normalizedDelta = delta / FRAME_REF_MS;

      // Use the RAF-provided `timestamp` (same clock as frame timing) so we
      // don't mix different time sources (RAF timestamp vs injected nowFn).
      // nowFn remains available for test/setup code and non-RAF-based timings.
      const fluctuation = Math.sin(timestamp * 0.01) * 0.02;

      rotation +=
        initialSpeed * normalizedDelta + fluctuation * normalizedDelta;
    }

    drawWheel();
    raf((ts) => accelerate(ts as number, initialSpeed));
  };

  /**
   * Start spinning the wheel. Optionally load and play a BGM blob.
   */
  const startSpin = async (bgm1Url?: Blob | null) => {
    if (bgm1Url) {
      try {
        await stopBgm();
        await loadBgm(bgm1Url);
        await playBgm({ isRepeat: true });
      } catch {
        /* ignore audio errors */
      }
    }
    spinning.value = true;
    // initialize RAF timing baseline
    lastTimestamp = nowFn();
    animationId = raf((ts) => accelerate(ts as number, 0.2));
  };

  /**
   * Deceleration animation function for stopping the spin.
   */
  const decelerate = async (
    decelerationStartTime: number,
    duration: number,
    initialSpeed: number,
    targetRotation: number,
    drawWheel: () => void,
    selectedPrize: PrizeDto | null
  ): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      console.debug("decelerate started", {
        decelerationStartTime,
        duration,
        initialSpeed,
        targetRotation,
      });
      const animate = () => {
        const elapsed = nowFn() - decelerationStartTime;
        const progress = Math.min(elapsed / (duration * 1000), 1);
        console.debug("decelerate animate", { elapsed, progress });
        // Cubic ease-out for smoother deceleration
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentSpeed = initialSpeed * (1 - easeProgress);
        rotation += currentSpeed;
        drawWheel();
        if (progress < 1) {
          raf(animate as FrameRequestCallback);
        } else {
          spinning.value = false;
          rotation = targetRotation;
          const prizeId = selectedPrize ? selectedPrize.id : null;
          console.debug("decelerate resolved", { prizeId });
          resolve(prizeId);
        }
      };
      animate();
    });
  };

  /**
   * Gradually decelerate and align the wheel to the selected prize (if any).
   * Resolves with the prize id or null.
   */
  const stopSpin = (
    durationSec: number = 3,
    targetPrizeId: string | null = null
  ) => {
    return new Promise<string | null>((resolve) => {
      const now = nowFn();

      if (lastTimestamp) {
        const deltaSinceLastFrame = Math.max(0, now - lastTimestamp);
        rotation += 0.2 * (deltaSinceLastFrame / FRAME_REF_MS);
        lastTimestamp = now;
      }

      // rotationNow in radians and degrees (normalized 0..360)
      const rotationNowRad = rotation;
      const rotationNowDeg =
        ((((rotationNowRad * 180) / Math.PI) % 360) + 360) % 360;
      console.log(
        "stopSpin invoked: rotation rad=",
        rotationNowRad,
        "deg=",
        rotationNowDeg,
        "durationSec=",
        durationSec,
        "targetPrizeId=",
        targetPrizeId
      );

      // Determine targetIndex by targetPrizeId (preferred) or props.selectedPrize
      let targetIndex = -1;
      if (typeof targetPrizeId === "string" && targetPrizeId.length > 0) {
        targetIndex = currentPrizes.findIndex((p) => p.id === targetPrizeId);
      } else if (props.selectedPrize) {
        targetIndex = currentPrizes.findIndex(
          (p) => p.id === props.selectedPrize!.id
        );
      }

      // Find the PrizeDto for the final target (may be null)
      const finalPrize: PrizeDto | null =
        targetIndex >= 0 ? currentPrizes[targetIndex] : null;

      // Calculate target rotation; allow a small random offset for naturalness
      const sectorAngle = getSectorAngle();
      const sectorCenter = sectorAngle / 2;
      const offset = sectorCenter + (Math.random() - 0.5) * (sectorAngle / 2);
      const targetRotation =
        targetIndex >= 0
          ? -(targetIndex * sectorAngle + offset) + Math.PI / 2
          : rotation;

      // Initial speed: current speed or a reasonable default
      const initialSpeed = 0.2;
      const decelerationStartTime = nowFn();
      const duration = durationSec;

      // Cancel existing animation
      if (animationId) {
        cancelRaf(animationId);
        animationId = null;
      }

      console.debug("calling decelerate", {
        decelerationStartTime,
        initialSpeed,
        targetRotation,
        duration,
      });

      decelerate(
        decelerationStartTime,
        duration,
        initialSpeed,
        targetRotation,
        drawWheel,
        finalPrize
      ).then((prizeId: string | null) => {
        console.debug("decelerate.then - prizeId", { prizeId });
        stopBgm()
          .catch(() => {
            /* ignore */
          })
          .finally(() => {
            console.debug("scheduling stopped emit timeout");
            if (emitDelayMs <= 0) {
              // emit synchronously (useful for tests)
              console.debug("emit stopped now (sync)", { prizeId });
              emit("stopped", prizeId);
              resolve(prizeId);
            } else {
              setTimeout(() => {
                console.debug("emit stopped now", { prizeId });
                emit("stopped", prizeId);
                resolve(prizeId);
              }, emitDelayMs);
            }
          });
      });
    });
  };

  onMounted(async () => {
    if (!canvas.value) return;
    ctx = canvas.value.getContext("2d");
    if (!ctx) return;

    await loadAllImages();
    drawWheel();
  });

  onUnmounted(async () => {
    try {
      await stopBgm();
    } catch {}
  });

  // update todo status for comment tracking
  try {
    // mark step 2 and 3 as completed in the todo list tool via side-effect (not enforced here)
  } catch (e) {}

  return {
    canvas,
    startSpin,
    stopSpin,
    spinning,
    updatePrizes,
  };
}
