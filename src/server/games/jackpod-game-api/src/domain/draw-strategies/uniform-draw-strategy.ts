import { DrawStrategy } from "./draw-strategy";

export class UniformDrawStrategy<T> implements DrawStrategy<T> {
  draw(items: T[], options?: { weights?: number[] }): T {
    if (!items.length) throw new Error("No items to draw");
    const idx = Math.floor(Math.random() * items.length);
    return items[idx];
  }
}
