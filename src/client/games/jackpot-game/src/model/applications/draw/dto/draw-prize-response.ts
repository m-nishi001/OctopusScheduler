export interface DrawPrizeResponse {
  drawId: string;
  winnerPrizeId: string | null;
  dummyPrizeIds: string[];
  isKakuhen?: boolean;
  reservedPrizeIds?: string[];
}
