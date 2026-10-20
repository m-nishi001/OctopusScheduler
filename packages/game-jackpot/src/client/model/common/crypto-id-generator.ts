import { injectable } from "tsyringe";

/** 一意な id を作る(`crypto.randomUUID`、無い環境では代わりの方法)。テストで差し替えられる。 */
@injectable()
export class CryptoIdGenerator {
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
