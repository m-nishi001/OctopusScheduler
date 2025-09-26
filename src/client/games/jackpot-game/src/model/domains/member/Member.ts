export interface Member {
  id: string;
  name: string;
  photoAssetId?: string;
  attributes?: string[];
  order: number;
}

export interface Prize {
  id: string;
  name: string;
  rank: 'high' | 'normal' | 'low';
}

export interface ScreenContent {
  id: string;
  screen: string;
  type: 'bgm' | 'video' | 'text';
  value: string;
}

export interface DrawResult {
  member: Member;
  prize: Prize;
  rank: string;
}
