import { injectable } from "tsyringe";
import { IdGenerator } from "../../domains/common/id-generator";

@injectable()
export class CryptoIdGenerator implements IdGenerator {
  nextId(): string {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
}
