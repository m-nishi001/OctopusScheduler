export interface PrizeDto {
  id: string;
  name: string;
  rank: number;
  imageAssetId?: string;
  description?: string;
  order: number;
  bgmAssetId?: string;
  seAssetIds?: string[];
}

export interface MemberDto {
  id: string;
  name: string;
  photoAssetId?: string;
  attributes?: string[];
  order: number;
}

export interface LotteryResultDto {
  memberId: string;
  prizeId: string;
  order: number;
  isWinner: boolean;
}

export interface AssetDto {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  url: string;
  name: string;
  uploadedAt: string;
  size: number;
  meta?: Record<string, any>;
}

export interface HistoryDto {
  id: string;
  drawName: string;
  result: LotteryResultDto[];
  savedAt: string;
}
