export interface Asset {
  id: string;
  type: "image" | "video" | "audio" | "text";
  // Optional binary data. Prefer using blob for binary handling; dataUrl kept for backward compatibility.
  blob?: Blob;
  dataUrl?: string;
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;
  directoryId?: string;
}
