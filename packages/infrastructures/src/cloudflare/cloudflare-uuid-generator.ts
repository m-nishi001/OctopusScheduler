import { injectable } from "tsyringe";
import type { IUuidGenerator } from "../interfaces/uuid";

/** `IUuidGenerator` の Cloudflare 実装(`crypto.randomUUID`)。 */
@injectable()
export class CloudflareUuidGenerator implements IUuidGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
