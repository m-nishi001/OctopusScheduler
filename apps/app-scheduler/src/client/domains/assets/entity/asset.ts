export interface Asset {
  id: string;
  // Binary data. Prefer using blob for binary handling; dataUrl kept for backward compatibility.
  blob: Blob;
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;
  directoryId?: string;
  uploaded?: boolean; // Temporary flag for uploaded assets before save
}
