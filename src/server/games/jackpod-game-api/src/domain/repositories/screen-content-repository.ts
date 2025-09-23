import { ScreenContent } from "../../domain/entities/screen-content";

export interface IScreenContentRepository {
  findAll(): Promise<ScreenContent[]>;
  save(content: ScreenContent): Promise<void>;
}
