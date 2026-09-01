import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import type { RouletteItem } from "./roulette-image-loader";

export interface RoulettePrizeDto extends PrizeDto {
  originalPrizeId?: string;
}

export interface AssetService {
  getAssetDataById(assetId: string): Promise<{ blob: Blob } | null>;
}

export async function prepareRenderPrizes(
  prizes: RoulettePrizeDto[],
  assetService: AssetService
): Promise<RouletteItem[]> {
  try {
    console.log(
      "[prepareRenderPrizes] incoming prizes:",
      prizes.map((p) => ({ id: p.id, originalPrizeId: p.originalPrizeId }))
    );

    // Use the incoming prize list as-is for rendering
    const adjusted = prizes.slice();

    console.log(
      "[prepareRenderPrizes] adjusted for rendering:",
      adjusted.map((p) => ({ id: p.id, originalPrizeId: p.originalPrizeId }))
    );

    // Ensure every adjusted item has an explicit originalPrizeId set
    adjusted.forEach((p) => {
      if (p.originalPrizeId === undefined) {
        p.originalPrizeId = p.id;
      }
    });

    // Diagnostic logging: show the adjusted list
    try {
      console.log(
        "[prepareRenderPrizes] adjusted ids:",
        adjusted.map((p) => ({ id: p.id, originalPrizeId: p.originalPrizeId }))
      );
    } catch (e) {
      console.warn("[prepareRenderPrizes] failed to log adjusted list", e);
    }

    const prepared: RouletteItem[] = await Promise.all(
      adjusted.map(async (p) => {
        const copy: RouletteItem = {
          id: p.id,
          prizeId: p.originalPrizeId,
          name: p.name,
          imageUrl: undefined,
        };
        if (p.imageAssetId) {
          try {
            const asset = await assetService.getAssetDataById(p.imageAssetId);
            if (asset && asset.blob) {
              copy.imageUrl = URL.createObjectURL(asset.blob);
            }
          } catch (e) {
            console.warn("Failed to prepare asset for prize", copy.id, e);
          }
        }
        return copy;
      })
    );
    return prepared;
  } catch (e) {
    console.error("Error preparing prize images", e);
    return [];
  }
}

export function revokePreparedPrizes(preparedPrizes: RouletteItem[]) {
  for (const p of preparedPrizes) {
    try {
      if (p.imageUrl) {
        URL.revokeObjectURL(p.imageUrl);
      }
    } catch {}
  }
}
