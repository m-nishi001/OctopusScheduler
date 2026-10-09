import { injectable } from "tsyringe";
import type { IPasswordHasher } from "../interfaces/password-hasher";

/** GASの実行時間制限に収まる範囲での反復回数(PBKDF2相当の簡易ストレッチ)。 */
const ROUNDS = 500;

function toHex(bytes: number[]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, "0")).join("");
}

@injectable()
export class GasPasswordHasher implements IPasswordHasher {
  async hash(password: string, salt: string): Promise<string> {
    // computeHmacSha256Signature は value/key が両方 string か両方 byte[] である必要がある。
    let digest = Utilities.computeHmacSha256Signature(password, salt);
    const saltBytes = Utilities.newBlob(salt).getBytes();
    for (let i = 1; i < ROUNDS; i++) {
      digest = Utilities.computeHmacSha256Signature(digest, saltBytes);
    }
    return toHex(digest);
  }
}
