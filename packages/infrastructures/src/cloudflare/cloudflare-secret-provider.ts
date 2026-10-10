import { injectable } from "tsyringe";
import type { ISecretProvider } from "../interfaces/secret-provider";
import { currentEnv } from "./request-context";

/** ISecretProvider の Cloudflare 実装(Worker の Secret / 環境変数。`wrangler secret put` で登録)。 */
@injectable()
export class CloudflareSecretProvider implements ISecretProvider {
  get(name: string): string | null {
    const value = (currentEnv() as unknown as Record<string, unknown>)[name];
    return typeof value === "string" && value !== "" ? value : null;
  }
}
