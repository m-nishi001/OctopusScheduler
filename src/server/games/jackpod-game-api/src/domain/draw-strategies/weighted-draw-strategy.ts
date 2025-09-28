import { DrawStrategy } from "./draw-strategy";

export class WeightedDrawStrategy<T> implements DrawStrategy<T> {
  draw(items: T[], options?: { weights?: number[] }): T {
    if (!items.length) throw new Error("No items to draw");
    if (!options?.weights || options.weights.length !== items.length) {
      throw new Error("Weights must be provided and match items length");
    }
    const total = options.weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= options.weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }
}
