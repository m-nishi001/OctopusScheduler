import { container } from "tsyringe";
import { DrawPoolProviderToken } from "../../model/draw/draw-pool";
import type { DrawPoolProvider } from "../../model/draw/draw-pool";

/** 抽選の対象を差し替える。JackpotContainer.register() のあとに呼ぶ（後から登録したものが優先される）。 */
export function setDrawPoolProvider(provider: DrawPoolProvider): void {
  container.register<DrawPoolProvider>(DrawPoolProviderToken, { useValue: provider });
}
