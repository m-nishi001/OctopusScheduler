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
    const prepared: RouletteItem[] = await Promise.all(
      prizes.map(async (p) => {
        const copy: RouletteItem = {
          id: p.id,
          prizeId: p.originalPrizeId ?? p.id,
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
