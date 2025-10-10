export interface Asset {
  id: string;
  type: "image" | "video" | "audio" | "text";
  dataUrl: string;
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;
}
