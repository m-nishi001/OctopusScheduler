import type { IFormRepository } from "@octopus/infrastructures/interfaces";

export class InMemoryFormRepository implements IFormRepository {
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
