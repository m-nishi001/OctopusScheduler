export interface PlayAudioEventData {
  id: string;
  type: "PlayAudioEvent";
  startTime: Date;
  endTime: Date;
  audioId: string;
  fadeOutDuration?: number;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;
}
