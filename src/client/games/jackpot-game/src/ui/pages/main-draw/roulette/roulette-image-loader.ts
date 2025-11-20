export type RouletteItem = {
  id: string; // visual id for the rotation sector
  prizeId?: string; // original prize id for backend match
  name: string;
  imageUrl?: string;
};

export interface InternalRouletteItem {
  id: string;
  prizeId?: string;
  name: string;
  imageElement: HTMLImageElement;
  index: number;
}

const DEFAULT_SVG_DATAURL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjY2NjIi8+CiAgPHRleHQgeD0iMzAiIHk9IjM1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMwMDAiPlByaXplPC90ZXh0Pgo8L3N2Zz4=";

const TRANSPARENT_DATAURL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export async function convertToInternal(
  prizes: RouletteItem[]
): Promise<InternalRouletteItem[]> {
  const loaders = prizes.map(async (prize, index) => {
    const rawCandidate = prize.imageUrl ?? TRANSPARENT_DATAURL;
    const candidateSrc = rawCandidate;
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => {
          const fallback = new Image();
          fallback.src = DEFAULT_SVG_DATAURL;
          resolve(fallback);
        };
      });

    const imageElement = await load(candidateSrc);
    return {
      id: prize.id,
      prizeId: (prize as any).prizeId ?? prize.id,
      name: prize.name,
      imageElement,
      index,
    };
  });

  return await Promise.all(loaders);
}
