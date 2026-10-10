/**
 * デプロイ物の外に置く設定値(シークレット)の読み出しの抽象化。
 * GAS では ScriptProperty、Cloudflare では Worker の Secret / 環境変数。
 * IKeyValueStorage はアプリが書き換えるデータ用で、保存先がプラットフォームごとに異なる
 * (Cloudflare では R2)ため、運用者が渡す設定はこちらで読む。
 */
export interface ISecretProvider {
  /** 未設定、または空文字なら null。 */
  get(name: string): string | null;
}

export const ISecretProviderToken = Symbol("ISecretProvider");
