export interface StopAudioEventData {
  id: string;
  type: "StopAudioEvent";
  startTime: Date;
  endTime: Date;
  audioId?: string;
  fadeOutDuration?: number;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;
}
