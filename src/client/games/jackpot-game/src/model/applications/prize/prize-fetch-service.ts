// import { injectable, inject } from "tsyringe";
// import type { PrizeDto } from "./dto/prize-dto";
// import { AssetService } from "../asset/asset-service";
// import { PrizeService } from "./prize-service";

// @injectable()
// export class PrizeFetchService {
//   constructor(
//     @inject(AssetService) private assetService: AssetService,
//     @inject(PrizeService) private prizeService: PrizeService
//   ) {}

//   async fetchPrizes(): Promise<PrizeDto[]> {
//     const prizes = await this.prizeService.fetchPrizes();

//     if (!Array.isArray(prizes) || !prizes) return [];

//     const resolvedPrizes = await Promise.all(
//       prizes.map(async (p) => {
//         const resolved = { ...p } as any;
//         if (p.imageAssetId) {
//           const asset = await this.assetService.getAssetById(p.imageAssetId);
//           const photoDataUrl = asset ? await asset.dataUrl : undefined;
//           resolved.imageDataUrl = asset ? await asset.dataUrl : undefined;
//         }
//         if (p.bgm1AssetId) {
//           const asset = await this.assetService.getAssetById(p.bgm1AssetId);
//           resolved.bgm1DataUrl = asset ? await asset.dataUrl : undefined;
//         }
//         if (p.bgm2AssetId) {
//           const asset = await this.assetService.getAssetById(p.bgm2AssetId);
//           resolved.bgm2DataUrl = asset ? await asset.dataUrl : undefined;
//         }
//         return resolved;
//       })
//     );

//     return resolvedPrizes;
//   }
// }
