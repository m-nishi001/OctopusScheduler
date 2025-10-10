import { injectable } from "tsyringe";
import {
  DrawService as DomainDrawService,
  DrawInput,
  DrawPair,
} from "../../domain/draw/draw-service";

@injectable()
export class DrawService {
  constructor(private domainDrawService: DomainDrawService) {}

  /**
   * 抽選を実行し、メンバーと景品のペアを返す。
   * @param input メンバー、景品、確変変数
   * @returns ペアの配列
   */
  draw(input: DrawInput): DrawPair[] {
    return this.domainDrawService.draw(input);
  }
}
