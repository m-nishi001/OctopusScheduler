import { injectable } from "tsyringe";

/**
 * Google Forms 連携の GAS 実装。
 *
 * Google Forms 固有の機能であり、将来 Cloudflare 版では自作UIに置き換わる予定で
 * 対応しなくても良いとされている。差し替え先が存在しないため契約インターフェースは
 * 持たず、この具象クラスをそのまま公開する。呼び出し側(quiz-game)は
 * `{ stopAcceptingResponses, getDestinationRecordStoreId }` を要求するローカルな
 * 依存型でこれを受け取り、Cloudflareアダプターを作る際はこのクラスに依存する
 * ユースケースを単に組み立てない、という形で「非対応」を表現する。
 */
@injectable()
export class GasFormRepository {
  stopAcceptingResponses(formId: string): void {
    const form = FormApp.openById(formId);
    form.setAcceptingResponses(false);
  }

  getDestinationRecordStoreId(formId: string): string | null {
    const form = FormApp.openById(formId);
    const destinationType = form.getDestinationType();
    if (destinationType === FormApp.DestinationType.SPREADSHEET) {
      return form.getDestinationId();
    }
    return null;
  }
}
