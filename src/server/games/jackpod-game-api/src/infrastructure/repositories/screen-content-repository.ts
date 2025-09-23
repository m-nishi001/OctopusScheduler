
import { IScreenContentRepository } from "../../domain/repositories/screen-content-repository";
import { ScreenContent } from "../../domain/entities/screen-content";
import { ISpreadsheetService, SpreadsheetService } from "../../../../../shared-packages/src/google-spreadsheet-service";

export class ScreenContentRepository implements IScreenContentRepository {
  private readonly repository: ISpreadsheetService<ScreenContent>;
  private readonly sheetName = "ScreenContents";

  constructor() {
    this.repository = SpreadsheetService.getService<ScreenContent>(this.sheetName);
  }

  async findAll(): Promise<ScreenContent[]> {
    return this.repository.find((c: ScreenContent) => true);
  }

  async save(content: ScreenContent): Promise<void> {
    this.repository.add(content);
  }
}
