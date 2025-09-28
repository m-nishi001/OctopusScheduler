export interface DrawStrategy<T> {
  draw(items: T[], options?: { weights?: number[] }): T;
}
