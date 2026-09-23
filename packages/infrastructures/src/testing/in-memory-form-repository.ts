/**
 * Google Forms 連携のテスト用フェイク。
 *
 * 対応する契約インターフェースは無い(Google Forms固有で差し替え先が無いため
 * `GasFormRepository` を直接使う設計になった)。構造的型付けにより、
 * `{ stopAcceptingResponses, getDestinationRecordStoreId }` を要求する
 * ローカルな依存型に対してそのまま渡せる。
 */
export class InMemoryFormRepository {
  private readonly destinations = new Map<string, string>();
  public readonly stoppedForms: string[] = [];

  setDestination(formId: string, recordStoreId: string): void {
    this.destinations.set(formId, recordStoreId);
  }

  stopAcceptingResponses(formId: string): void {
    this.stoppedForms.push(formId);
  }

  getDestinationRecordStoreId(formId: string): string | null {
    return this.destinations.get(formId) ?? null;
  }
}
