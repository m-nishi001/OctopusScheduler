import { injectable } from "tsyringe";
import type { IUuidGenerator } from "../interfaces/uuid";

@injectable()
export class GasUuidGenerator implements IUuidGenerator {
  generate(): string {
    return Utilities.getUuid();
  }
}
