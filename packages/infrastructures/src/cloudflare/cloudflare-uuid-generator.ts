import { injectable } from "tsyringe";
import type { IUuidGenerator } from "../interfaces/uuid";

@injectable()
export class CloudflareUuidGenerator implements IUuidGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
