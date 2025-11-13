export const RandomProviderToken = "RandomProvider";

export interface RandomProvider {
  /**
   * Return next uniform float in [0, 1).
   */
  next(): number;
  /**
   * Return integer in range [0, max). If max <= 0 returns 0.
   */
  nextInt(max: number): number;
}
