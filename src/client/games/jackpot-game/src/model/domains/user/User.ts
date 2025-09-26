export interface User {
  id: string;
  name: string;
  email?: string;
  photoAssetId?: string;
  attributes?: string[];
  order?: number;
}
