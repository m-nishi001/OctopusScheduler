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
    // Detect kakuhen case: presence of a pair like <base>__k1 and <base>__k2
    const ids = new Set(prizes.map((p) => p.id));
    let isKakuhen = false;
    for (const p of prizes) {
      const m = /(.+)__k1$/.exec(p.id);
      if (m) {
        const base = m[1];
        if (ids.has(`${base}__k2`)) {
          isKakuhen = true;
          break;
        }
      }
    }

    // Normalize prize list for rendering:
    // - If kakuhen, keep the incoming list as-is (kakuhen expects its own clone ids)
    // - Otherwise, force exactly 8 items: if more, take first 8; if fewer, duplicate
    //   originals round-robin and assign unique ids for duplicates while preserving originalPrizeId
    let adjusted: RoulettePrizeDto[];
    if (isKakuhen) {
      adjusted = prizes.slice();
    } else {
      const target = 8;
      if (prizes.length >= target) {
        adjusted = prizes.slice(0, target);
      } else if (prizes.length === 0) {
        adjusted = [];
      } else {
        adjusted = prizes.slice();
        let dupIndex = 0;
        while (adjusted.length < target) {
          const src = prizes[dupIndex % prizes.length];
          const clone: RoulettePrizeDto = {
            ...src,
            id: `${src.id}__dup${Math.floor(dupIndex / prizes.length)}_${dupIndex % prizes.length}`,
            originalPrizeId: src.originalPrizeId ?? src.id,
          };
          adjusted.push(clone);
          dupIndex++;
        }
      }
    }

    const prepared: RouletteItem[] = await Promise.all(
      adjusted.map(async (p) => {
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
