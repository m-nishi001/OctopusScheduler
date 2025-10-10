// import { injectable, inject } from "tsyringe";
// import type { MemberDto } from "./dto/member-dto";
// import { AssetService } from "../asset/asset-service";
// import { MemberService } from "./member-service";

// @injectable()
// export class MemberFetchService {
//   constructor(
//     @inject(AssetService) private assetService: AssetService,
//     @inject(MemberService) private memberService: MemberService
//   ) {}

//   async fetchMembers(): Promise<MemberDto[]> {
//     const members = await this.memberService.fetchMembers();

//     if (!Array.isArray(members) || !members) return [];

//     const resolvedMembers = await Promise.all(
//       members.map(async (m) => {
//         if (m.photoAssetId) {
//           const asset = await this.assetService.getAssetById(m.photoAssetId);
//           const photoDataUrl = asset ? await asset.dataUrl : undefined;
//           return { ...m, photoDataUrl };
//         }
//         return m;
//       })
//     );

//     return resolvedMembers;
//   }
// }
