/**
 * パスワードのハッシュ化の抽象化。
 * GAS には WebCrypto が無く、Cloudflare には Utilities が無いため、プラットフォームごとに
 * 実装する。同じ (password, salt) からは常に同じ文字列(hex)を返す。
 * ハッシュ値は保存先プラットフォーム内でのみ比較されるため、実装間の互換性は不要。
 */
export interface IPasswordHasher {
  hash(password: string, salt: string): Promise<string>;
}

export const IPasswordHasherToken = Symbol("IPasswordHasher");
