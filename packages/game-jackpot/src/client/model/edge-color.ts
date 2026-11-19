/** 画像の縁の色を求めるための、最小のピクセルデータ(`ImageData` と同じ形)。 */
export interface PixelData {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const hex = (n: number): string => n.toString(16).padStart(2, "0");

/**
 * 画像の縁(外周1ピクセルぶん)のピクセルの、色の中央値(チャンネルごと)を `#rrggbb` で返す。
 * 透明度は見ない(RGB だけで決める)。外周は4辺を合わせて重複なく数える。幅・高さが 0 や、データが足りないときは null。
 */
export function edgeColor({ data, width, height }: PixelData): string | null {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return null;
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    r.push(data[i]);
    g.push(data[i + 1]);
    b.push(data[i + 2]);
  };
  for (let x = 0; x < width; x++) {
    add(x, 0);
    if (height > 1) add(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    add(0, y);
    if (width > 1) add(width - 1, y);
  }
  return `#${hex(median(r))}${hex(median(g))}${hex(median(b))}`;
}
