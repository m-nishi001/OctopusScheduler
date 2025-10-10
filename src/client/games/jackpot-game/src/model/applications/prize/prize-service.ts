// import { injectable, inject } from "tsyringe";
// import type { IPrizeRepository } from "../../domains/prize/repository/IPrizeRepository";
// import type { PrizeDto } from "./dto/prize-dto";

// @injectable()
// export class PrizeService {
//   constructor(@inject("IPrizeRepository") private repo: IPrizeRepository) {}

//   async fetchPrizes(): Promise<PrizeDto[]> {
//     return this.repo.fetchPrizes();
//   }

//   async batchOperations(operations: {
//     add: PrizeDto[];
//     update: PrizeDto[];
//     delete: string[];
//   }): Promise<void> {
//     await this.repo.batchOperations(
//       operations.add,
//       operations.update,
//       operations.delete
//     );
//   }
// }
