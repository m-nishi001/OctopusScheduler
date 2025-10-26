export interface DrawPrizeResponse {
  drawId: string;
  winnerPrizeId: string | null;
  dummyWinnerPrizeId?: string | null;
  dummyPrizeIds: string[];
  isKakuhen?: boolean;
  reservedPrizeIds?: string[];
}
