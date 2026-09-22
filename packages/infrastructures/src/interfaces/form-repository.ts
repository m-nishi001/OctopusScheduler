/**
 * フォーム連携の抽象化(GASでは FormApp)。
 *
 * Google Form 固有の機能であり、将来 Cloudflare 版では自作UIに置き換わる予定で
 * 対応しなくても良いとされている。それでもクイズ機能側のビジネスロジックを
 * 純粋に保つため、契約としては切り出しておく。Cloudflareアダプターを作る際は
 * このポートに依存するユースケースを単に組み立てない、という形で「非対応」を表現する。
 */
export interface IFormRepository {
  stopAcceptingResponses(formId: string): void;

  /** フォームの回答先スプレッドシートIDを返す。連携が無い場合は null。 */
  getDestinationRecordStoreId(formId: string): string | null;
}

export const IFormRepositoryToken = Symbol("IFormRepository");
