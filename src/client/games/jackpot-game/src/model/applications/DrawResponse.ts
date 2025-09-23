export interface DrawResponse {
  drawId: string;
  status: 'pending' | 'drawing' | 'completed';
}
