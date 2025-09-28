export interface Asset {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  url: string;
  name: string;
  uploadedAt: string;
  size: number;
  meta?: Record<string, any>;
}
