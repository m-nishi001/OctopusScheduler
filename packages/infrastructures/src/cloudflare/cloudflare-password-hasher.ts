import { injectable } from "tsyringe";
import type { IPasswordHasher } from "../interfaces/password-hasher";

/** Workers の PBKDF2 は反復回数 100000 が上限。 */
const ITERATIONS = 100_000;

@injectable()
export class CloudflarePasswordHasher implements IPasswordHasher {
  async hash(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: ITERATIONS },
      key,
      256
    );
    return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
  }
}
