import { injectable } from "tsyringe";
import type { IUuidGenerator } from "../interfaces/uuid";

/** `IUuidGenerator` の GAS 実装(`Utilities.getUuid`)。 */
@injectable()
export class GasUuidGenerator implements IUuidGenerator {
  generate(): string {
    return Utilities.getUuid();
  }
}
