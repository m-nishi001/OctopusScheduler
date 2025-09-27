
import { injectable, inject } from "tsyringe";
import { IDrawResultRepository } from "../../domain/repositories/draw-result-repository";
import { DrawResult } from "../../domain/entities/draw-result";
import { GasService } from "./gas-service";

@injectable()
export class DrawResultService implements GasService {
  readonly serviceName = "DrawResultService";
  readonly functions: Record<string, (args: any) => any>;

  constructor(@inject("IDrawResultRepository") private readonly repository: IDrawResultRepository) {
    this.functions = {
      getAll: this.getAll.bind(this),
      getById: this.getById.bind(this),
      save: this.save.bind(this)
    };
  }

  async getAll(): Promise<DrawResult[]> {
    return this.repository.findAll();
  }

  async getById(args: { drawId: string }): Promise<DrawResult | null> {
    return this.repository.findById(args.drawId);
  }

  async save(args: { result: DrawResult }): Promise<void> {
    return this.repository.save(args.result);
  }
}
